const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
    issuer: 'CartLy-ecommerce',
    audience: 'CartLy-users',
  });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    issuer: 'CartLy-ecommerce',
    audience: 'CartLy-users',
  });

const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'CartLy-ecommerce',
    audience: 'CartLy-users',
  });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: 'CartLy-ecommerce',
    audience: 'CartLy-users',
  });

const generateTokenPair = (userId, role) => {
  const payload = { id: userId, role };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 15 * 60 * 1000,
  path: '/',
});

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: parseInt(process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh',
});

const generateEmailToken = () => {
  const token = crypto.randomBytes(20).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  return { token, hashedToken, expiry };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  generateEmailToken,
};
