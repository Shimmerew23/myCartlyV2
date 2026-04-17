const express = require('express');
const {
  authenticate, optionalAuth, requireSeller, requireAdmin, uploadLimiter, upload, processImages,
} = require('../middleware/index');
const productCtrl = require('../controllers/productController');
const { cache } = require('../config/redis');

// Simple cache middleware
const cacheMiddleware = (ttl = 300, keyPrefix = '') => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const key = `cache:${keyPrefix}:${req.originalUrl}:${req.user?._id || 'public'}`;
  const cached = await cache.get(key);
  if (cached) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
  const origJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 200) cache.set(key, data, ttl);
    res.setHeader('X-Cache', 'MISS');
    return origJson(data);
  };
  next();
};

// Product router
const productRouter = express.Router();

productRouter.get('/', optionalAuth, cacheMiddleware(300, 'products'), productCtrl.getProducts);
productRouter.get('/featured', cacheMiddleware(600, 'products'), productCtrl.getFeaturedProducts);
productRouter.get('/my-products', authenticate, requireSeller, productCtrl.getMyProducts);
productRouter.get('/seller-stats', authenticate, requireSeller, productCtrl.getSellerStats);
productRouter.get('/:slug', optionalAuth, productCtrl.getProduct);
productRouter.get('/:id/related', productCtrl.getRelatedProducts);
productRouter.post('/:id/wishlist', authenticate, productCtrl.toggleWishlist);

productRouter.post('/',
  authenticate, requireSeller, uploadLimiter,
  upload.array('images', 10),
  processImages({ width: 1200, height: 1200, quality: 85, folder: 'cartly/products' }),
  productCtrl.createProduct
);

productRouter.put('/:id',
  authenticate, requireSeller, uploadLimiter,
  upload.array('images', 10),
  processImages({ width: 1200, height: 1200, quality: 85, folder: 'cartly/products' }),
  productCtrl.updateProduct
);

productRouter.delete('/:id', authenticate, requireSeller, productCtrl.deleteProduct);

// Category router
const Category = require('../models/Category');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const slugify = require('slugify');

const categoryRouter = express.Router();

categoryRouter.get('/', cacheMiddleware(600, 'categories'), async (req, res, next) => {
  try {
    const cacheKey = 'categories:all';
    const cached = await cache.get(cacheKey);
    if (cached) return ApiResponse.success(res, cached);
    const categories = await Category.find({ isActive: true }).sort('sortOrder name').lean();
    await cache.set(cacheKey, categories, 600);
    return ApiResponse.success(res, categories);
  } catch (err) { next(err); }
});

categoryRouter.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const category = await Category.create({ ...req.body, slug });
    await cache.del('categories:all');
    return ApiResponse.created(res, category);
  } catch (err) { next(err); }
});

categoryRouter.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return next(ApiError.notFound('Category not found'));
    await cache.del('categories:all');
    return ApiResponse.success(res, category);
  } catch (err) { next(err); }
});

categoryRouter.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    await cache.del('categories:all');
    return ApiResponse.success(res, null, 'Category deactivated');
  } catch (err) { next(err); }
});

module.exports = { productRouter, categoryRouter };
