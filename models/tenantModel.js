// models/Tenant.model.js
import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true
  },
  consented: {
    type: Boolean,
    default: false
  },
  consentedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

tenantSchema.index({ tenantId: 1 }, { unique: true });

export const Tenant = mongoose.model('Tenant', tenantSchema);