const express = require('express');
const {
  authenticate, optionalAuth, requireAdmin, requireSuperAdmin,
  auditLog, cacheMiddleware,
} = require('../middleware/index');

const {
  getDashboardStats,
  getAllUsers, updateUser, deleteUser, approveSeller,
  getAllProducts, adminUpdateProduct,
  getAllOrders,
  createCoupon, getCoupons, deleteCoupon,
  createCategory, getCategories, updateCategory, deleteCategory,
  getAuditLogs,
  getFeedbacks, updateFeedbackStatus, submitFeedback,
} = require('../controllers/adminController');

// Carrier controller from warehouse-service (admin manages carriers too)
const carrierCtrl = require('../controllers/carrierController');

// ─── Admin router (requires admin role) ──────────────────────
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/dashboard', cacheMiddleware(120, 'admin'), getDashboardStats);

adminRouter.get('/users', getAllUsers);
adminRouter.put('/users/:userId', auditLog('UPDATE_USER', 'User'), updateUser);
adminRouter.delete('/users/:userId', auditLog('DELETE_USER', 'User'), deleteUser);
adminRouter.post('/users/:userId/approve-seller', auditLog('APPROVE_SELLER', 'User'), approveSeller);

adminRouter.get('/products', getAllProducts);
adminRouter.put('/products/:id', auditLog('ADMIN_UPDATE_PRODUCT', 'Product'), adminUpdateProduct);

adminRouter.get('/orders', getAllOrders);

adminRouter.get('/coupons', getCoupons);
adminRouter.post('/coupons', createCoupon);
adminRouter.delete('/coupons/:id', deleteCoupon);

adminRouter.get('/carriers', carrierCtrl.getAllCarriers);
adminRouter.post('/carriers', carrierCtrl.createCarrier);
adminRouter.put('/carriers/:id', carrierCtrl.updateCarrier);
adminRouter.delete('/carriers/:id', carrierCtrl.deleteCarrier);

adminRouter.get('/audit-logs', requireSuperAdmin, getAuditLogs);

adminRouter.get('/feedback', getFeedbacks);
adminRouter.put('/feedback/:id', updateFeedbackStatus);

// ─── Category router (public GET, admin POST/PUT/DELETE) ──────
const categoryRouter = express.Router();
categoryRouter.get('/', getCategories);
categoryRouter.post('/', authenticate, requireAdmin, createCategory);
categoryRouter.put('/:id', authenticate, requireAdmin, updateCategory);
categoryRouter.delete('/:id', authenticate, requireAdmin, deleteCategory);

// ─── Feedback submission (public) ────────────────────────────
const feedbackRouter = express.Router();
feedbackRouter.post('/', optionalAuth, submitFeedback);

module.exports = { adminRouter, categoryRouter, feedbackRouter };
