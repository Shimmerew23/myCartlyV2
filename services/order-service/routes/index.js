const express = require('express');
const { authenticate, requireSeller, requireAdmin } = require('../middleware/index');
const orderCtrl = require('../controllers/orderController');

const router = express.Router();

// Stripe webhook — raw body (handled in server.js before json parser)
router.post('/webhook', express.raw({ type: 'application/json' }), orderCtrl.stripeWebhook);

router.post('/', authenticate, orderCtrl.createOrder);
router.get('/my-orders', authenticate, orderCtrl.getMyOrders);
router.get('/seller-orders', authenticate, requireSeller, orderCtrl.getSellerOrders);
router.get('/:id', authenticate, orderCtrl.getOrder);
router.put('/:id/status', authenticate, requireSeller, orderCtrl.updateOrderStatus);
router.post('/:id/return', authenticate, orderCtrl.requestReturn);

module.exports = router;
