const express = require('express');
const {
  verifyApiKey,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmation,
  sendSellerApprovalEmail,
  sendCustomEmail,
} = require('../controllers/notificationController');

const router = express.Router();

// All notification endpoints require internal API key
router.use(verifyApiKey);

router.post('/verification', sendVerificationEmail);
router.post('/password-reset', sendPasswordResetEmail);
router.post('/order-confirmation', sendOrderConfirmation);
router.post('/seller-approval', sendSellerApprovalEmail);
router.post('/custom', sendCustomEmail);

module.exports = router;
