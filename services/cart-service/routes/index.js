const express = require('express');
const { authenticate } = require('../middleware/index');
const {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart, applyCoupon,
} = require('../controllers/cartController');

const router = express.Router();

router.get('/', authenticate, getCart);
router.post('/add', authenticate, addToCart);
router.put('/items/:itemId', authenticate, updateCartItem);
router.delete('/items/:itemId', authenticate, removeFromCart);
router.delete('/', authenticate, clearCart);
router.post('/coupon', authenticate, applyCoupon);

module.exports = router;
