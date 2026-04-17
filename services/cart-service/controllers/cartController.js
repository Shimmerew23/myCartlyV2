const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate({
        path: 'items.product',
        select: 'name price images slug status stock discountedPrice rating seller',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'seller', select: 'name sellerProfile.storeName sellerProfile.storeLogo' },
        ],
      });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const validItems = cart.items.filter(
      (item) => item.product && item.product.status === 'active'
    );
    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    return ApiResponse.success(res, {
      items: cart.items,
      subtotal: cart.subtotal,
      itemCount: cart.itemCount,
      coupon: cart.coupon?.code ? cart.coupon : null,
    });
  } catch (err) { next(err); }
};

const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, variant } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(ApiError.notFound('Product not found'));
    if (product.status !== 'active') return next(ApiError.badRequest('Product unavailable'));
    if (product.trackInventory && product.stock < quantity) {
      return next(ApiError.badRequest(`Only ${product.stock} items in stock`));
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.variant?.value === variant?.value
    );

    if (existingItemIndex > -1) {
      const newQty = cart.items[existingItemIndex].quantity + quantity;
      if (product.trackInventory && newQty > product.stock) {
        return next(ApiError.badRequest(`Only ${product.stock} items available`));
      }
      cart.items[existingItemIndex].quantity = newQty;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        variant,
        price: product.discountedPrice || product.price,
      });
    }

    cart.lastModified = Date.now();
    await cart.save();
    await cart.populate({
      path: 'items.product',
      select: 'name price images slug status stock',
      populate: { path: 'seller', select: 'name sellerProfile.storeName sellerProfile.storeLogo' },
    });

    return ApiResponse.success(res, {
      items: cart.items,
      subtotal: cart.subtotal,
      itemCount: cart.itemCount,
    }, 'Added to cart');
  } catch (err) { next(err); }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(ApiError.notFound('Cart not found'));

    const item = cart.items.id(req.params.itemId);
    if (!item) return next(ApiError.notFound('Cart item not found'));

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
    } else {
      const product = await Product.findById(item.product);
      if (product?.trackInventory && quantity > product.stock) {
        return next(ApiError.badRequest(`Only ${product.stock} items available`));
      }
      item.quantity = quantity;
    }

    await cart.save();
    await cart.populate({
      path: 'items.product',
      select: 'name price images slug status',
      populate: { path: 'seller', select: 'name sellerProfile.storeName sellerProfile.storeLogo' },
    });

    return ApiResponse.success(res, {
      items: cart.items,
      subtotal: cart.subtotal,
      itemCount: cart.itemCount,
    });
  } catch (err) { next(err); }
};

const removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { _id: req.params.itemId } } },
      { new: true }
    ).populate({
      path: 'items.product',
      select: 'name price images slug',
      populate: { path: 'seller', select: 'name sellerProfile.storeName sellerProfile.storeLogo' },
    });

    return ApiResponse.success(res, {
      items: cart?.items || [],
      subtotal: cart?.subtotal || 0,
      itemCount: cart?.itemCount || 0,
    }, 'Item removed');
  } catch (err) { next(err); }
};

const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], coupon: undefined });
    return ApiResponse.success(res, null, 'Cart cleared');
  } catch (err) { next(err); }
};

const applyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) return next(ApiError.notFound('Invalid coupon code'));
    if (coupon.validUntil < new Date()) return next(ApiError.badRequest('Coupon has expired'));
    if (coupon.validFrom > new Date()) return next(ApiError.badRequest('Coupon not yet active'));
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return next(ApiError.badRequest('Coupon usage limit reached'));
    }

    const userUsage = coupon.usedBy.filter(
      (u) => u.user.toString() === req.user._id.toString()
    ).length;
    if (userUsage >= coupon.userUsageLimit) {
      return next(ApiError.badRequest('You have already used this coupon'));
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return next(ApiError.notFound('Cart not found'));

    if (cart.subtotal < coupon.minimumOrderAmount) {
      return next(ApiError.badRequest(`Minimum order amount is $${coupon.minimumOrderAmount}`));
    }

    cart.coupon = {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      validUntil: coupon.validUntil,
    };
    await cart.save();

    return ApiResponse.success(res, { coupon: cart.coupon, subtotal: cart.subtotal });
  } catch (err) { next(err); }
};

module.exports = {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart, applyCoupon,
};
