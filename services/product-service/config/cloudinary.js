const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');

if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadBuffer = (buffer, options = {}) => {
  const { folder = 'cartly', ...rest } = options;
  const public_id = `${folder}/${uuidv4()}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', public_id, ...rest },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

const deleteImage = async (public_id) => {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (_) {}
};

const connectCloudinary = async () => {
  const hasUrl = !!process.env.CLOUDINARY_URL;
  const hasVars = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
  if (!hasUrl && !hasVars) throw new Error('Cloudinary credentials are missing');
  try {
    await cloudinary.api.resources({ max_results: 1 });
  } catch (err) {
    throw new Error(err?.message || err?.error?.message || JSON.stringify(err));
  }
};

module.exports = { cloudinary, uploadBuffer, deleteImage, connectCloudinary };
