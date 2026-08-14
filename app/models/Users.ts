import { Schema, model, models, Document } from "mongoose";

export type UserRole = "customer" | "admin" | "driver";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  vehicleType?: string; // drivers only
  isAvailable?: boolean; // drivers only
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
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "admin", "driver"],
      default: "customer",
      required: true,
    },
    vehicleType: { type: String },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default models.User || model<IUser>("User", UserSchema);