import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    text: { type: String, required: true, maxlength: 2000 },
    isDirect: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Create indexes for faster queries
messageSchema.index({ sender: 1, receiver: 1, isDirect: 1 });
messageSchema.index({ receiver: 1, isRead: 1, isDirect: 1 });

// Use existing model if already compiled, otherwise create new
export default mongoose.models.Message || mongoose.model('Message', messageSchema);