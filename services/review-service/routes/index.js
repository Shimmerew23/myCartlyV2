const express = require('express');
const { authenticate } = require('../middleware/index');
const {
  getProductReviews, createReview, updateReview, deleteReview, voteHelpful,
} = require('../controllers/reviewController');

// mergeParams: true so that :productId from the gateway is available
const router = express.Router({ mergeParams: true });

router.get('/', getProductReviews);
router.post('/', authenticate, createReview);
router.put('/:reviewId', authenticate, updateReview);
router.delete('/:reviewId', authenticate, deleteReview);
router.post('/:reviewId/helpful', authenticate, voteHelpful);

module.exports = router;
