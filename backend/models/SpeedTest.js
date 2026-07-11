const mongoose = require('mongoose');

const speedTestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    network: { type: String, enum: ['mtn', 'glo', 'airtel', 'etisalat', null], default: null },
    downloadMbps: { type: Number, required: true },
    uploadMbps: { type: Number },
    pingMs: { type: Number },
    lat: { type: Number }, // optional - only present if the user allowed location access
    lng: { type: Number },
    location: { type: { type: String, enum: ['Point'] }, coordinates: [Number] }, // GeoJSON mirror of lat/lng, for geospatial queries
    discountAwarded: { type: Boolean, default: false } // true only for the one submission that ever unlocked the first-purchase voucher
  },
  { timestamps: true }
);

speedTestSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SpeedTest', speedTestSchema);
