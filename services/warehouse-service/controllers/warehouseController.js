const crypto = require('crypto');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Order = require('../models/Order');
const Carrier = require('../models/Carrier');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendEmail, emailTemplates } = require('../utils/email');
const logger = require('../utils/logger');

// ============================================================
// ADMIN — Warehouse account management
// ============================================================

// @desc    Create a warehouse account (user with role=warehouse) + linked Warehouse record
// @route   POST /api/admin/warehouses
// @access  Admin / Superadmin
const createWarehouse = async (req, res, next) => {
  try {
    const { name, code, street, city, state, country, zipCode, managerName, managerEmail, notes } = req.body;

    if (!name || !code || !street || !city || !state || !zipCode || !managerName || !managerEmail) {
      return next(ApiError.badRequest('All required fields must be provided'));
    }

    // Check code uniqueness
    const existingWarehouse = await Warehouse.findOne({ code: code.toUpperCase() });
    if (existingWarehouse) {
      return next(ApiError.conflict('A warehouse with this code already exists'));
    }

    // Check manager email uniqueness
    const existingUser = await User.findOne({ email: managerEmail.toLowerCase() });
    if (existingUser) {
      return next(ApiError.conflict('A user with this email already exists'));
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(10).toString('hex') + 'Wh!';

    // Create the warehouse user account
    const warehouseUser = await User.create({
      name: managerName,
      email: managerEmail.toLowerCase(),
      password: tempPassword,
      role: 'warehouse',
      isEmailVerified: true, // admin-created accounts skip email verification
    });

    // Create the warehouse record
    const warehouse = await Warehouse.create({
      name,
      code: code.toUpperCase(),
      address: { street, city, state, country: country || 'US', zipCode },
      manager: warehouseUser._id,
      notes,
    });

    // Send credentials email to the warehouse account
    try {
      await sendEmail({
        to: managerEmail,
        subject: 'Your CartLy Warehouse Account',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to CartLy Warehouse Portal</h2>
            <p>Hi <strong>${managerName}</strong>,</p>
            <p>Your warehouse account has been created for <strong>${name}</strong> (Code: ${code.toUpperCase()}).</p>
            <p>Use the credentials below to log in:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Email:</strong> ${managerEmail}</p>
              <p style="margin: 8px 0 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>
            <p>Please change your password after your first login.</p>
            <p style="color: #888; font-size: 12px;">This email was sent by CartLy Admin.</p>
          </div>
        `,
      });
    } catch (e) {
      logger.error(`Warehouse credentials email failed: ${e.message}`);
    }

    const populated = await Warehouse.findById(warehouse._id).populate('manager', 'name email');
    logger.info(`Warehouse created: ${name} (${code}) by admin ${req.user.email}`);
    return ApiResponse.created(res, populated, 'Warehouse account created successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get all warehouses
// @route   GET /api/admin/warehouses
// @access  Admin / Superadmin
const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find()
      .populate('manager', 'name email isActive lastLoginAt')
      .sort('-createdAt')
      .lean();
    return ApiResponse.success(res, warehouses);
  } catch (err) {
    next(err);
  }
};

// @desc    Update warehouse info
// @route   PUT /api/admin/warehouses/:id
// @access  Admin / Superadmin
const updateWarehouse = async (req, res, next) => {
  try {
    const { name, street, city, state, country, zipCode, isActive, notes } = req.body;

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return next(ApiError.notFound('Warehouse not found'));

    if (name !== undefined) warehouse.name = name;
    if (isActive !== undefined) {
      warehouse.isActive = isActive;
      // Also toggle the user account
      await User.findByIdAndUpdate(warehouse.manager, { isActive });
    }
    if (notes !== undefined) warehouse.notes = notes;
    if (street || city || state || country || zipCode) {
      warehouse.address = {
        street: street || warehouse.address.street,
        city: city || warehouse.address.city,
        state: state || warehouse.address.state,
        country: country || warehouse.address.country,
        zipCode: zipCode || warehouse.address.zipCode,
      };
    }

    await warehouse.save();
    const populated = await Warehouse.findById(warehouse._id).populate('manager', 'name email isActive lastLoginAt');
    return ApiResponse.success(res, populated, 'Warehouse updated');
  } catch (err) {
    next(err);
  }
};

// @desc    Delete warehouse + its user account
// @route   DELETE /api/admin/warehouses/:id
// @access  Admin / Superadmin
const deleteWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return next(ApiError.notFound('Warehouse not found'));

    await User.findByIdAndDelete(warehouse.manager);
    await warehouse.deleteOne();

    return ApiResponse.success(res, null, 'Warehouse deleted');
  } catch (err) {
    next(err);
  }
};

// ============================================================
// WAREHOUSE — Parcel scanning & check-in
// ============================================================

// @desc    Look up an order by orderNumber or _id
// @route   GET /api/warehouse/scan?q=CUR-xxx
// @access  Warehouse / Admin / Superadmin
const scanOrder = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 3) {
      return next(ApiError.badRequest('Provide an order number or ID to scan'));
    }

    const query = q.trim();
    let order = null;

    // Try orderNumber first (format: CUR-xxx), then _id
    if (query.startsWith('CUR-') || query.includes('-')) {
      order = await Order.findOne({ orderNumber: query.toUpperCase() })
        .populate('user', 'name email phone')
        .populate('items.product', 'name images')
        .populate('tracking.carrierId', 'name')
        .lean();
    }

    if (!order && /^[a-f\d]{24}$/i.test(query)) {
      order = await Order.findById(query)
        .populate('user', 'name email phone')
        .populate('items.product', 'name images')
        .populate('tracking.carrierId', 'name')
        .lean();
    }

    if (!order) {
      return next(ApiError.notFound(`No order found for: "${query}"`));
    }

    return ApiResponse.success(res, order);
  } catch (err) {
    next(err);
  }
};

// @desc    Warehouse check-in — update parcel location / advance status
// @route   PUT /api/warehouse/orders/:id/check-in
// @access  Warehouse / Admin / Superadmin
//
// Body:
//   action: 'location_update' | 'mark_processing' | 'mark_shipped' | 'mark_out_for_delivery' | 'mark_delivered'
//   location: String   (free-text location note, e.g. "Arrived at Warehouse NYC")
//   note: String       (optional extra note)
//   trackingNumber: String  (required for mark_shipped)
//   carrierId: String       (optional for mark_shipped)
const checkInParcel = async (req, res, next) => {
  try {
    const { action, location, note, trackingNumber, carrierId } = req.body;

    if (!action) return next(ApiError.badRequest('action is required'));

    const order = await Order.findById(req.params.id);
    if (!order) return next(ApiError.notFound('Order not found'));

    // Determine warehouse name for the log
    let warehouseName = null;
    if (req.user.role === 'warehouse') {
      const wh = await Warehouse.findOne({ manager: req.user._id });
      warehouseName = wh ? wh.locationLabel : req.user.name;
    }

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['out_for_delivery', 'delivered'],
      out_for_delivery: ['delivered'],
      delivered: ['return_requested'],
      return_requested: ['returned', 'delivered'],
      returned: ['refunded'],
    };

    const actionToStatus = {
      mark_processing: 'processing',
      mark_shipped: 'shipped',
      mark_out_for_delivery: 'out_for_delivery',
      mark_delivered: 'delivered',
    };

    if (action === 'location_update') {
      // Only update tracking location — no status change
      if (!location) return next(ApiError.badRequest('location is required for location_update'));
      if (!order.tracking) order.tracking = {};
      order.tracking.lastLocation = location;
      order.tracking.lastLocationUpdatedAt = new Date();
      order.statusHistory.push({
        status: order.status,
        note: `Location update: ${location}${note ? ` — ${note}` : ''}`,
        updatedBy: req.user._id,
        warehouseName,
      });
    } else if (actionToStatus[action]) {
      const newStatus = actionToStatus[action];

      if (!validTransitions[order.status]?.includes(newStatus)) {
        return next(ApiError.badRequest(`Cannot transition order from "${order.status}" to "${newStatus}"`));
      }

      order.status = newStatus;
      const historyNote = [location && `Location: ${location}`, note].filter(Boolean).join(' — ');
      order.statusHistory.push({
        status: newStatus,
        note: historyNote || undefined,
        updatedBy: req.user._id,
        warehouseName,
      });

      // Handle shipped
      if (newStatus === 'shipped' && trackingNumber) {
        let resolvedCarrierName = null;
        let resolvedTrackingUrl = null;
        if (carrierId) {
          const carrier = await Carrier.findById(carrierId);
          if (carrier) {
            resolvedCarrierName = carrier.name;
            if (carrier.trackingUrlTemplate) {
              resolvedTrackingUrl = carrier.trackingUrlTemplate.replace('{trackingNumber}', trackingNumber);
            }
          }
        }
        order.tracking = {
          ...order.tracking,
          carrier: resolvedCarrierName,
          carrierId: carrierId || undefined,
          trackingNumber,
          trackingUrl: resolvedTrackingUrl,
          lastLocation: location || order.tracking?.lastLocation,
          lastLocationUpdatedAt: location ? new Date() : order.tracking?.lastLocationUpdatedAt,
        };
      }

      if (location && newStatus !== 'shipped') {
        if (!order.tracking) order.tracking = {};
        order.tracking.lastLocation = location;
        order.tracking.lastLocationUpdatedAt = new Date();
      }

      if (newStatus === 'delivered') order.deliveredAt = new Date();
    } else {
      return next(ApiError.badRequest(`Unknown action: "${action}"`));
    }

    await order.save();
    logger.info(`Warehouse check-in: order ${order.orderNumber} — action=${action} by ${req.user.email}`);
    return ApiResponse.success(res, order, 'Parcel updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createWarehouse,
  getWarehouses,
  updateWarehouse,
  deleteWarehouse,
  scanOrder,
  checkInParcel,
};
