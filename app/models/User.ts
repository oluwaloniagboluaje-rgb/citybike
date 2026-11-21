import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "customer" | "admin" | "driver";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  vehicleType?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  deactivatedAt?: Date;
  marketingConsent?: boolean;
  marketingConsentAt?: Date;
  marketingUnsubscribedAt?: Date;
  resetPasswordTokenHash?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "driver"],
      default: "customer",
    },
    vehicleType: String,
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: Date,
    marketingConsent: {
      type: Boolean,
      default: false,
      index: true,
    },
    marketingConsentAt: Date,
    marketingUnsubscribedAt: Date,
    resetPasswordTokenHash: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;