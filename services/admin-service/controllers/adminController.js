const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const AuditLog = require('../models/AuditLog');
const Coupon = require('../models/Coupon');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendEmail, emailTemplates } = require('../utils/email');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const slugify = require('slugify');

// ─── Dashboard ────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const cacheKey = 'admin:dashboard';
    const cached = await cache.get(cacheKey);
    if (cached) return ApiResponse.success(res, cached);

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers, newUsersThisMonth,
      totalSellers, pendingSellerApprovals,
      totalProducts, activeProducts,
      totalOrders, ordersThisMonth,
      revenueStats, revenueLastMonth,
      ordersByStatus, recentOrders, topSellingProducts, categoryStats,
    ] = await Promise.all([
      User.countDocuments({ role: { $in: ['user', 'seller'] } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      User.countDocuments({ role: 'seller' }),
      User.countDocuments({ role: 'seller', 'sellerProfile.isApproved': false }),
      Product.countDocuments(),
      Product.countDocuments({ status: 'active' }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: thisMonth } }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: lastMonth, $lt: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.find().sort('-createdAt').limit(5).populate('user', 'name email').lean(),
      Product.find({ status: 'active' }).sort('-sales').limit(5).select('name price sales revenue images').lean(),
      Category.aggregate([
        { $lookup: { from: 'products', localField: '_id', foreignField: 'category', as: 'products' } },
        { $project: { name: 1, productCount: { $size: '$products' } } },
        { $sort: { productCount: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const thisMonthRevenue = revenueStats[0]?.total || 0;
    const lastMonthRevenue = revenueLastMonth[0]?.total || 0;
    const revenueGrowth = lastMonthRevenue
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    const data = {
      users: { total: totalUsers, newThisMonth: newUsersThisMonth },
      sellers: { total: totalSellers, pendingApprovals: pendingSellerApprovals },
      products: { total: totalProducts, active: activeProducts },
      orders: { total: totalOrders, thisMonth: ordersThisMonth, byStatus: ordersByStatus },
      revenue: { thisMonth: thisMonthRevenue, lastMonth: lastMonthRevenue, growth: Math.round(revenueGrowth * 10) / 10 },
      recentOrders,
      topSellingProducts,
      categoryStats,
    };

    await cache.set(cacheKey, data, 120);
    return ApiResponse.success(res, data);
  } catch (err) { next(err); }
};

// ─── Users ────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.isBanned !== undefined) filter.isBanned = req.query.isBanned === 'true';
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const sortMap = { '-createdAt': { createdAt: -1 }, createdAt: { createdAt: 1 }, name: { name: 1 }, '-name': { name: -1 }, role: { role: 1 } };
    const sort = sortMap[req.query.sort] || { createdAt: -1 };

    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, users, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    const allowedFields = ['role', 'isActive', 'isBanned', 'banReason'];
    if (req.user.role !== 'superadmin') allowedFields.splice(allowedFields.indexOf('role'), 1);

    const updateData = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
    if (updateData.isBanned) updateData.bannedAt = Date.now();

    const user = await User.findByIdAndUpdate(req.params.userId, updateData, { new: true });
    if (!user) return next(ApiError.notFound('User not found'));

    logger.info(`Admin ${req.user.email} updated user ${user.email}`);
    return ApiResponse.success(res, user.toSafeObject(), 'User updated');
  } catch (err) { next(err); }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return next(ApiError.notFound('User not found'));
    if (user.role === 'superadmin') return next(ApiError.forbidden('Cannot delete superadmin'));

    await User.findByIdAndUpdate(req.params.userId, { isActive: false, isBanned: true });
    logger.info(`Admin ${req.user.email} deactivated user ${user.email}`);
    return ApiResponse.success(res, null, 'User deactivated');
  } catch (err) { next(err); }
};

const approveSeller = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'seller') return next(ApiError.notFound('Seller not found'));

    user.sellerProfile.isApproved = true;
    user.sellerProfile.approvedAt = Date.now();
    await user.save();

    try {
      const { subject, html } = emailTemplates.sellerApproval(user.name);
      await sendEmail({ to: user.email, subject, html });
    } catch (e) { logger.error(`Seller approval email failed: ${e.message}`); }

    logger.info(`Seller approved: ${user.email} by ${req.user.email}`);
    return ApiResponse.success(res, null, 'Seller approved successfully');
  } catch (err) { next(err); }
};

// ─── Products (admin view) ────────────────────────────────────
const getAllProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.seller) filter.seller = req.query.seller;
    if (req.query.search) filter.$text = { $search: req.query.search };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(req.query.sort || '-createdAt')
        .skip(skip).limit(limit)
        .populate('category', 'name')
        .populate('seller', 'name email sellerProfile.storeName')
        .lean(),
      Product.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, products, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

const adminUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return next(ApiError.notFound('Product not found'));
    await cache.flush('cache:products:*');
    return ApiResponse.success(res, product, 'Product updated');
  } catch (err) { next(err); }
};

// ─── Orders ───────────────────────────────────────────────────
const getAllOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.search) filter.$or = [{ orderNumber: { $regex: req.query.search, $options: 'i' } }];

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(req.query.sort || '-createdAt')
        .skip(skip).limit(limit)
        .populate('user', 'name email')
        .lean(),
      Order.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, orders, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ─── Coupons ──────────────────────────────────────────────────
const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create({ ...req.body, createdBy: req.user._id });
    return ApiResponse.created(res, coupon, 'Coupon created');
  } catch (err) { next(err); }
};

const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt').lean();
    return ApiResponse.success(res, coupons);
  } catch (err) { next(err); }
};

const deleteCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    return ApiResponse.success(res, null, 'Coupon deleted');
  } catch (err) { next(err); }
};

// ─── Categories ───────────────────────────────────────────────
const createCategory = async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const category = await Category.create({ ...req.body, slug });
    await cache.del('categories:all');
    await cache.flush('cache:categories:*');
    return ApiResponse.created(res, category);
  } catch (err) { next(err); }
};

const getCategories = async (req, res, next) => {
  try {
    const cacheKey = 'categories:all';
    const cached = await cache.get(cacheKey);
    if (cached) return ApiResponse.success(res, cached);

    const categories = await Category.find({ isActive: true }).sort('sortOrder name').lean();
    await cache.set(cacheKey, categories, 600);
    return ApiResponse.success(res, categories);
  } catch (err) { next(err); }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return next(ApiError.notFound('Category not found'));
    await cache.del('categories:all');
    return ApiResponse.success(res, category, 'Category updated');
  } catch (err) { next(err); }
};

const deleteCategory = async (req, res, next) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    await cache.del('categories:all');
    return ApiResponse.success(res, null, 'Category deactivated');
  } catch (err) { next(err); }
};

// ─── Audit Logs ───────────────────────────────────────────────
const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const filter = {};
    if (req.query.user) filter.user = req.query.user;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resource) filter.resource = req.query.resource;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name email role')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, logs, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ─── Feedback ────────────────────────────────────────────────
const getFeedbacks = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name email role avatar')
        .lean(),
      Feedback.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, feedbacks, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

const updateFeedbackStatus = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { ...(status ? { status } : {}), ...(adminNote !== undefined ? { adminNote } : {}) },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!feedback) return next(ApiError.notFound('Feedback not found'));
    return ApiResponse.success(res, feedback, 'Feedback updated');
  } catch (err) { next(err); }
};

// ─── Feedback submission (public/optional auth) ───────────────
const submitFeedback = async (req, res, next) => {
  try {
    const { category, subject, message, rating, guestName, guestEmail } = req.body;
    const isGuest = !req.user;

    if (!category || !subject?.trim() || !message?.trim()) {
      return next(ApiError.badRequest('Category, subject, and message are required.'));
    }
    if (isGuest && message.trim().length > 300) {
      return next(ApiError.badRequest('Message must be 300 characters or fewer for guest submissions.'));
    }

    const feedback = await Feedback.create({
      ...(req.user ? { user: req.user._id } : {}),
      ...(isGuest && guestName ? { guestName } : {}),
      ...(isGuest && guestEmail ? { guestEmail } : {}),
      category, subject, message,
      ...(rating ? { rating } : {}),
    });
    return ApiResponse.created(res, feedback, 'Feedback submitted. Thank you!');
  } catch (err) { next(err); }
};

module.exports = {
  getDashboardStats,
  getAllUsers, updateUser, deleteUser, approveSeller,
  getAllProducts, adminUpdateProduct,
  getAllOrders,
  createCoupon, getCoupons, deleteCoupon,
  createCategory, getCategories, updateCategory, deleteCategory,
  getAuditLogs,
  getFeedbacks, updateFeedbackStatus, submitFeedback,
};
