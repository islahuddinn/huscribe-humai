import mongoose from 'mongoose';

const adminConsentSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  hasConsent: {
    type: Boolean,
    default: false
  },
  consentDate: {
    type: Date,
    default: null
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  scopes: [{
    type: String
  }],
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
adminConsentSchema.index({ tenantId: 1, email: 1 });

const AdminConsent = mongoose.model('AdminConsent', adminConsentSchema);

export default AdminConsent; 