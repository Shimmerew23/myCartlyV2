const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: String,
    resourceId: mongoose.Schema.Types.ObjectId,
    method: String,
    path: String,
    statusCode: Number,
    ip: String,
    userAgent: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90-day TTL

module.exports = mongoose.model('AuditLog', auditLogSchema);
