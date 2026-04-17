const { sendEmail, emailTemplates } = require('../utils/email');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// Internal API key authentication
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.NOTIFICATION_API_KEY) {
    return next(ApiError.unauthorized('Invalid API key'));
  }
  next();
};

// POST /notify/verification
const sendVerificationEmail = async (req, res, next) => {
  try {
    const { to, name, token, frontendUrl } = req.body;
    if (!to || !name || !token) return next(ApiError.badRequest('to, name, token required'));

    const { subject, html } = emailTemplates.verification(name, token, frontendUrl || process.env.FRONTEND_URL);
    await sendEmail({ to, subject, html });
    return ApiResponse.success(res, null, 'Verification email sent');
  } catch (err) { next(err); }
};

// POST /notify/password-reset
const sendPasswordResetEmail = async (req, res, next) => {
  try {
    const { to, name, token, frontendUrl } = req.body;
    if (!to || !name || !token) return next(ApiError.badRequest('to, name, token required'));

    const { subject, html } = emailTemplates.passwordReset(name, token, frontendUrl || process.env.FRONTEND_URL);
    await sendEmail({ to, subject, html });
    return ApiResponse.success(res, null, 'Password reset email sent');
  } catch (err) { next(err); }
};

// POST /notify/order-confirmation
const sendOrderConfirmation = async (req, res, next) => {
  try {
    const { to, order, user } = req.body;
    if (!to || !order || !user) return next(ApiError.badRequest('to, order, user required'));

    const { subject, html } = emailTemplates.orderConfirmation(order, user);
    await sendEmail({ to, subject, html });
    return ApiResponse.success(res, null, 'Order confirmation email sent');
  } catch (err) { next(err); }
};

// POST /notify/seller-approval
const sendSellerApprovalEmail = async (req, res, next) => {
  try {
    const { to, name } = req.body;
    if (!to || !name) return next(ApiError.badRequest('to, name required'));

    const { subject, html } = emailTemplates.sellerApproval(name);
    await sendEmail({ to, subject, html });
    return ApiResponse.success(res, null, 'Seller approval email sent');
  } catch (err) { next(err); }
};

// POST /notify/custom — generic email send
const sendCustomEmail = async (req, res, next) => {
  try {
    const { to, subject, html, text } = req.body;
    if (!to || !subject || !html) return next(ApiError.badRequest('to, subject, html required'));

    await sendEmail({ to, subject, html, text });
    return ApiResponse.success(res, null, 'Email sent');
  } catch (err) { next(err); }
};

module.exports = {
  verifyApiKey,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmation,
  sendSellerApprovalEmail,
  sendCustomEmail,
};
