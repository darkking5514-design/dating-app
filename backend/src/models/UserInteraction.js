import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['like', 'pass'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 2592000 } // auto delete after 30 days? optional
});

interactionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

export default mongoose.model('UserInteraction', interactionSchema);