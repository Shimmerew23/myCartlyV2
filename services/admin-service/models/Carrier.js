const mongoose = require('mongoose');

const carrierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    trackingUrlTemplate: { type: String, default: null },
    logoUrl: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

carrierSchema.index({ isActive: 1, sortOrder: 1, name: 1 });

const Carrier = mongoose.model('Carrier', carrierSchema);
module.exports = Carrier;
