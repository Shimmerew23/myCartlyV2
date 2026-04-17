const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guestName: { type: String, maxlength: 80, trim: true },
    guestEmail: { type: String, maxlength: 120, trim: true, lowercase: true },
    category: {
      type: String,
      enum: ['bug', 'feature', 'general', 'complaint', 'praise'],
      required: true,
    },
    subject: { type: String, required: true, maxlength: 150, trim: true },
    message: { type: String, required: true, maxlength: 2000, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' },
    adminNote: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ user: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
