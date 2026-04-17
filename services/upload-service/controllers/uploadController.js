const sharp = require('sharp');
const { uploadBuffer, deleteImage } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');

// POST /upload/images — upload multiple images
const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(ApiError.badRequest('No files provided'));
    }

    const {
      width = 1200,
      height = 1200,
      quality = 85,
      folder = 'cartly/uploads',
    } = req.body;

    const processFile = async (file) => {
      const buffer = await sharp(file.buffer)
        .resize(parseInt(width), parseInt(height), { fit: 'inside', withoutEnlargement: true })
        .toFormat('webp', { quality: parseInt(quality) })
        .toBuffer();

      const { url, public_id } = await uploadBuffer(buffer, { folder, format: 'webp' });
      return { url, public_id, originalname: file.originalname };
    };

    const results = await Promise.all(req.files.map(processFile));
    logger.info(`Uploaded ${results.length} images to ${folder}`);
    return ApiResponse.success(res, results, `${results.length} image(s) uploaded`);
  } catch (err) { next(err); }
};

// POST /upload/image — upload single image
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(ApiError.badRequest('No file provided'));

    const {
      width = 800,
      height = 800,
      quality = 85,
      folder = 'cartly/uploads',
    } = req.body;

    const buffer = await sharp(req.file.buffer)
      .resize(parseInt(width), parseInt(height), { fit: 'inside', withoutEnlargement: true })
      .toFormat('webp', { quality: parseInt(quality) })
      .toBuffer();

    const { url, public_id } = await uploadBuffer(buffer, { folder, format: 'webp' });
    return ApiResponse.success(res, { url, public_id }, 'Image uploaded');
  } catch (err) { next(err); }
};

// DELETE /upload/image — delete image from Cloudinary
const deleteUploadedImage = async (req, res, next) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return next(ApiError.badRequest('public_id required'));

    await deleteImage(public_id);
    return ApiResponse.success(res, null, 'Image deleted');
  } catch (err) { next(err); }
};

module.exports = { uploadImages, uploadImage, deleteUploadedImage };
