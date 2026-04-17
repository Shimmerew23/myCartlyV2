const express = require('express');
const { authenticate, uploadLimiter, upload } = require('../middleware/index');
const { uploadImages, uploadImage, deleteUploadedImage } = require('../controllers/uploadController');

const router = express.Router();

// All upload routes require authentication
router.use(authenticate);

router.post('/images', uploadLimiter, upload.array('images', 10), uploadImages);
router.post('/image', uploadLimiter, upload.single('image'), uploadImage);
router.delete('/image', deleteUploadedImage);

module.exports = router;
