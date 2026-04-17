const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    description: String,
    image: String,
    icon: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    productCount: { type: Number, default: 0 },
    seo: { metaTitle: String, metaDescription: String },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

categorySchema.index({ parent: 1 });

module.exports = mongoose.model('Category', categorySchema);
