import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema(
  {
    users: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    }],
  },
  { timestamps: true }
);

// Add index for faster queries (not unique)
friendSchema.index({ users: 1 });
friendSchema.index({ 'users.0': 1, 'users.1': 1 });

// Virtual to check if user is friend
friendSchema.methods.isFriend = function(userId) {
  return this.users.some(id => id.toString() === userId.toString());
};

export default mongoose.model('Friend', friendSchema);