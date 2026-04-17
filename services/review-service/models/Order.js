// Minimal Order model for verified-purchase check in reviews
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      quantity: Number,
      price: Number,
    }],
    status: { type: String, default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
