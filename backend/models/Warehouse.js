const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Warehouse code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, 'Code cannot exceed 20 characters'],
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true, default: 'US' },
      zipCode: { type: String, required: true },
    },
    // The user account that operates this warehouse
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

warehouseSchema.index({ code: 1 });
warehouseSchema.index({ manager: 1 });

// Virtual: full location string used in parcel tracking logs
warehouseSchema.virtual('locationLabel').get(function () {
  return `${this.name} — ${this.address.city}, ${this.address.state}`;
});

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
module.exports = Warehouse;
