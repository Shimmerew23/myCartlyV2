const mongoose = require('mongoose');
require('./Category'); // register Category model for population

const productSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    price: Number,
    images: [{ url: String, public_id: String, alt: String, isPrimary: Boolean }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stock: { type: Number, default: 0 },
    trackInventory: { type: Boolean, default: true },
    status: { type: String, default: 'active' },
    discount: {
      type: { type: String },
      value: Number,
      validFrom: Date,
      validUntil: Date,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual('discountedPrice').get(function () {
  if (!this.discount?.value) return this.price;
  const now = new Date();
  if (this.discount.validFrom && now < this.discount.validFrom) return this.price;
  if (this.discount.validUntil && now > this.discount.validUntil) return this.price;
  if (this.discount.type === 'percentage') {
    return Math.round((this.price * (1 - this.discount.value / 100)) * 100) / 100;
  }
  return Math.max(0, this.price - this.discount.value);
});

module.exports = mongoose.model('Product', productSchema);
