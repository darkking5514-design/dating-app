import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, min: 18, max: 120 },
    gender: { type: String, enum: ['male', 'female', 'nonbinary', 'other'] },
    interestedIn: [{ type: String, enum: ['male', 'female', 'nonbinary', 'other'] }],
    bio: { type: String, default: '', maxlength: 500 },
    interests: [{ type: String }],
    photos: [{ type: String }],
    location: { 
      city: { type: String, default: 'London' },
      country: { type: String, default: 'United Kingdom' },
      lat: { type: Number },
      lng: { type: Number }
    },
    settings: {
      showMe: { type: Boolean, default: true },
      showInTopPicks: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: false },
      distance: { type: Number, default: 50 },
      ageMin: { type: Number, default: 18 },
      ageMax: { type: Number, default: 40 },
      genderPreference: { type: String, enum: ['men', 'women', 'everyone'], default: 'women' }
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    age: this.age,
    gender: this.gender,
    interestedIn: this.interestedIn,
    bio: this.bio,
    interests: this.interests,
    photos: this.photos,
    location: this.location,
    settings: this.settings || {
      showMe: true,
      showInTopPicks: true,
      readReceipts: false,
      distance: 50,
      ageMin: 18,
      ageMax: 40,
      genderPreference: 'women'
    }
  };
};

export default mongoose.model('User', userSchema);