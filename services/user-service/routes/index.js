const express = require('express');
const {
  authenticate, requireSeller, uploadLimiter, upload, processImages,
} = require('../middleware/index');

const {
  updateProfile, addAddress, updateAddress, deleteAddress,
  upgradeToSeller, updateSellerProfile, getSellerStore, getWishlist,
} = require('../controllers/userController');

const router = express.Router();

router.get('/wishlist', authenticate, getWishlist);
router.get('/store/:slug', getSellerStore);

router.put('/profile',
  authenticate, uploadLimiter,
  upload.single('avatar'),
  processImages({ width: 400, height: 400, quality: 90, folder: 'cartly/avatars' }),
  updateProfile
);

router.post('/upgrade-seller',
  authenticate, uploadLimiter,
  upload.single('storeLogo'),
  processImages({ width: 400, height: 400, folder: 'cartly/avatars' }),
  upgradeToSeller
);

router.put('/seller-profile',
  authenticate, uploadLimiter,
  upload.fields([{ name: 'storeLogo', maxCount: 1 }, { name: 'storeBanner', maxCount: 1 }]),
  updateSellerProfile
);

router.post('/addresses', authenticate, addAddress);
router.put('/addresses/:addressId', authenticate, updateAddress);
router.delete('/addresses/:addressId', authenticate, deleteAddress);

module.exports = router;
