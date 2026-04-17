const express = require('express');
const passport = require('passport');

const {
  authenticate, authLimiter, validate, schemas,
} = require('../middleware/index');

const authCtrl = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), authCtrl.register);
router.post('/login', authLimiter, validate(schemas.login), authCtrl.login);
router.post('/logout', authenticate, authCtrl.logout);
router.post('/refresh', authCtrl.refreshToken);
router.get('/me', authenticate, authCtrl.getMe);
router.post('/forgot-password', authLimiter, authCtrl.forgotPassword);
router.put('/reset-password/:token', authLimiter, authCtrl.resetPassword);
router.get('/verify-email/:token', authCtrl.verifyEmail);
router.put('/change-password', authenticate, authCtrl.changePassword);
router.post('/resend-verification', authenticate, authCtrl.resendVerification);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google` }),
  authCtrl.oauthCallback
);

module.exports = router;
