const User = require('../models/User');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const slugify = require('slugify');
const sharp = require('sharp');
const { uploadBuffer, deleteImage } = require('../config/cloudinary');

const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'dateOfBirth', 'gender', 'preferences'];
    const updateData = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    if (req.processedImage) {
      const existing = await User.findById(req.user._id).select('avatarPublicId');
      await deleteImage(existing?.avatarPublicId);
      updateData.avatar = req.processedImage.url;
      updateData.avatarPublicId = req.processedImage.public_id;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    return ApiResponse.success(res, user.toSafeObject(), 'Profile updated');
  } catch (err) { next(err); }
};

const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }
    user.addresses.push(req.body);
    await user.save();
    return ApiResponse.success(res, user.addresses, 'Address added');
  } catch (err) { next(err); }
};

const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return next(ApiError.notFound('Address not found'));
    if (req.body.isDefault) {
      user.addresses.forEach((a) => { a.isDefault = false; });
    }
    Object.assign(addr, req.body);
    await user.save();
    return ApiResponse.success(res, user.addresses, 'Address updated');
  } catch (err) { next(err); }
};

const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses = user.addresses.filter(
      (a) => a._id.toString() !== req.params.addressId
    );
    await user.save();
    return ApiResponse.success(res, user.addresses, 'Address deleted');
  } catch (err) { next(err); }
};

const upgradeToSeller = async (req, res, next) => {
  try {
    const { storeName, storeBio } = req.body;
    const user = await User.findById(req.user._id);

    if (user.role === 'seller') return next(ApiError.conflict('Already a seller'));

    const storeSlug = slugify(storeName, { lower: true, strict: true });
    const slugExists = await User.findOne({ 'sellerProfile.storeSlug': storeSlug });
    if (slugExists) return next(ApiError.conflict('Store name already taken'));

    user.role = 'seller';
    user.sellerProfile = { storeName, storeBio, storeSlug, isApproved: false };

    if (req.processedImage) {
      user.sellerProfile.storeLogo = req.processedImage.url;
    }

    await user.save();
    return ApiResponse.success(res, user.toSafeObject(), 'Seller application submitted. Awaiting admin approval.');
  } catch (err) { next(err); }
};

const updateSellerProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !['seller', 'admin', 'superadmin'].includes(user.role)) {
      return next(ApiError.forbidden('Seller account required'));
    }

    const { storeName, storeBio, storeEmail, storePhone, returnPolicy, shippingPolicy } = req.body;
    let socialLinks;
    if (req.body.socialLinks) {
      try { socialLinks = typeof req.body.socialLinks === 'string' ? JSON.parse(req.body.socialLinks) : req.body.socialLinks; } catch {}
    }

    const update = {};
    if (storeName !== undefined) update['sellerProfile.storeName'] = storeName;
    if (storeBio !== undefined) update['sellerProfile.storeBio'] = storeBio;
    if (storeEmail !== undefined) update['sellerProfile.storeEmail'] = storeEmail;
    if (storePhone !== undefined) update['sellerProfile.storePhone'] = storePhone;
    if (returnPolicy !== undefined) update['sellerProfile.returnPolicy'] = returnPolicy;
    if (shippingPolicy !== undefined) update['sellerProfile.shippingPolicy'] = shippingPolicy;
    if (socialLinks) update['sellerProfile.socialLinks'] = socialLinks;

    if (req.files?.storeLogo?.[0] || req.files?.storeBanner?.[0]) {
      const existing = await User.findById(req.user._id).select('sellerProfile.storeLogoPublicId sellerProfile.storeBannerPublicId');
      if (req.files?.storeLogo?.[0]) {
        await deleteImage(existing?.sellerProfile?.storeLogoPublicId);
        const buffer = await sharp(req.files.storeLogo[0].buffer)
          .resize(400, 400, { fit: 'inside' })
          .toFormat('webp', { quality: 85 })
          .toBuffer();
        const { url, public_id } = await uploadBuffer(buffer, { folder: 'cartly/avatars', format: 'webp' });
        update['sellerProfile.storeLogo'] = url;
        update['sellerProfile.storeLogoPublicId'] = public_id;
      }
      if (req.files?.storeBanner?.[0]) {
        await deleteImage(existing?.sellerProfile?.storeBannerPublicId);
        const buffer = await sharp(req.files.storeBanner[0].buffer)
          .resize(1200, 400, { fit: 'inside' })
          .toFormat('webp', { quality: 85 })
          .toBuffer();
        const { url, public_id } = await uploadBuffer(buffer, { folder: 'cartly/banners', format: 'webp' });
        update['sellerProfile.storeBanner'] = url;
        update['sellerProfile.storeBannerPublicId'] = public_id;
      }
    }

    const updated = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    return ApiResponse.success(res, updated.toSafeObject(), 'Store profile updated');
  } catch (err) { next(err); }
};

const getSellerStore = async (req, res, next) => {
  try {
    const seller = await User.findOne({ 'sellerProfile.storeSlug': req.params.slug })
      .select('name sellerProfile createdAt')
      .lean();
    if (!seller) return next(ApiError.notFound('Store not found'));

    const products = await Product.find({ seller: seller._id, status: 'active' })
      .sort('-createdAt')
      .limit(20)
      .lean();

    return ApiResponse.success(res, { seller, products });
  } catch (err) { next(err); }
};

const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'wishlist',
        select: 'name price images slug status rating',
        populate: { path: 'category', select: 'name slug' },
      });
    return ApiResponse.success(res, user.wishlist);
  } catch (err) { next(err); }
};

module.exports = {
  updateProfile, addAddress, updateAddress, deleteAddress,
  upgradeToSeller, updateSellerProfile, getSellerStore, getWishlist,
};
