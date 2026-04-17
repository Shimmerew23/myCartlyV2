const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    price: Number,
    images: [{ url: String, public_id: String, alt: String, isPrimary: Boolean }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
