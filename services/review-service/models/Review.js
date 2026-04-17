const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 100 },
    body: { type: String, maxlength: 1000 },
    images: [String],
    isVerifiedPurchase: { type: Boolean, default: false },
    helpfulVotes: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: true },
    sellerReply: { body: String, repliedAt: Date },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, rating: -1 });
reviewSchema.index({ user: 1 });

// Post-save: Update product rating aggregate
reviewSchema.post('save', async function () {
  await updateProductRating(this.product);
});

reviewSchema.post('deleteOne', { document: true }, async function () {
  await updateProductRating(this.product);
});

async function updateProductRating(productId) {
  const Product = mongoose.model('Product');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { product: productId, isApproved: true } },
    {
      $group: {
        _id: '$product',
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
        dist1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        dist2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        dist3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        dist4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        dist5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      'rating.average': Math.round(stats[0].avg * 10) / 10,
      'rating.count': stats[0].count,
      'rating.distribution.1': stats[0].dist1,
      'rating.distribution.2': stats[0].dist2,
      'rating.distribution.3': stats[0].dist3,
      'rating.distribution.4': stats[0].dist4,
      'rating.distribution.5': stats[0].dist5,
    });
  } else {
    await Product.findByIdAndUpdate(productId, { 'rating.average': 0, 'rating.count': 0 });
  }
}

module.exports = mongoose.model('Review', reviewSchema);
