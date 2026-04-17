const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const filter = { product: productId, isApproved: true };
    if (req.query.rating) filter.rating = parseInt(req.query.rating);

    const sortMap = {
      '-createdAt': { createdAt: -1 },
      '-helpfulVotes': { helpfulVotes: -1 },
      '-rating': { rating: -1 },
      rating: { rating: 1 },
    };
    const sort = sortMap[req.query.sort] || { createdAt: -1 };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name avatar')
        .lean(),
      Review.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, reviews, {
      page, limit, total, pages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

const createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return next(ApiError.notFound('Product not found'));

    const existingReview = await Review.findOne({ product: productId, user: req.user._id });
    if (existingReview) return next(ApiError.conflict('Already reviewed this product'));

    const purchasedOrder = await Order.findOne({
      user: req.user._id,
      'items.product': productId,
      status: 'delivered',
    });

    const review = await Review.create({
      ...req.body,
      product: productId,
      user: req.user._id,
      isVerifiedPurchase: !!purchasedOrder,
    });

    await review.populate('user', 'name avatar');
    return ApiResponse.created(res, review, 'Review submitted');
  } catch (err) { next(err); }
};

const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return next(ApiError.notFound('Review not found'));
    if (review.user.toString() !== req.user._id.toString()) {
      return next(ApiError.forbidden());
    }
    Object.assign(review, req.body);
    await review.save();
    return ApiResponse.success(res, review, 'Review updated');
  } catch (err) { next(err); }
};

const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return next(ApiError.notFound('Review not found'));

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return next(ApiError.forbidden());

    await review.deleteOne();
    return ApiResponse.success(res, null, 'Review deleted');
  } catch (err) { next(err); }
};

const voteHelpful = async (req, res, next) => {
  try {
    await Review.findByIdAndUpdate(req.params.reviewId, { $inc: { helpfulVotes: 1 } });
    return ApiResponse.success(res, null, 'Vote recorded');
  } catch (err) { next(err); }
};

module.exports = { getProductReviews, createReview, updateReview, deleteReview, voteHelpful };
