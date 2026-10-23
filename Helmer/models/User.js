import mongoose from 'mongoose';

/**
 * User Schema — MongoDB model for Google OAuth authenticated users.
 * Stores Google profile identifier, display name, email, avatar, and audit timestamps.
 */
const UserSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    avatar: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model re-compilation if already defined in runtime cache
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
