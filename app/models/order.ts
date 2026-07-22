import mongoose, { Schema, Document, Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type ServiceType =
  | "local"
  | "interstate"
  | "international"
  | "dhl_express"
  | "ecommerce"
  | "errand"
  | "corporate";

export type PaymentMethod = "bank_transfer" | "paystack" | "cash";

export type PaymentStatus = "pending" | "paid" | "failed";

export interface ILocationPoint {
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface IOrder extends Document {
  trackingNumber: string;
  customer?: Types.ObjectId;
  senderName?: string;
  senderPhone?: string;
  isAdminCreated?: boolean;
  driver?: Types.ObjectId;
  pickup: ILocationPoint;
  dropoff: ILocationPoint;
  serviceType: ServiceType;
  isInternational: boolean;
  packageDescription: string;
  packageSize: "small" | "medium" | "large";
  weightKg?: number;
  recipientName: string;
  recipientPhone: string;
  pickupTime: Date;
  eta?: Date;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date }[];
  price?: number;
  lastLocation?: { lat: number; lng: number; updatedAt: Date };
  locationHistory?: { lat: number; lng: number; updatedAt: Date }[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  proofOfPaymentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationPointSchema = new Schema<ILocationPoint>(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true, default: "Nigeria" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    senderName: String,
    senderPhone: String,

    isAdminCreated: {
      type: Boolean,
      default: false,
    },

    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    pickup: {
      type: LocationPointSchema,
      required: true,
    },

    dropoff: {
      type: LocationPointSchema,
      required: true,
    },

    serviceType: {
      type: String,
      enum: [
        "local",
        "interstate",
        "international",
        "dhl_express",
        "ecommerce",
        "errand",
        "corporate",
      ],
      default: "local",
      required: true,
    },

    isInternational: {
      type: Boolean,
      default: false,
    },

    packageDescription: {
      type: String,
      required: true,
    },

    packageSize: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "small",
    },

    weightKg: Number,

    recipientName: {
      type: String,
      required: true,
    },

    recipientPhone: {
      type: String,
      required: true,
    },

    pickupTime: {
      type: Date,
      default: Date.now,
    },

    eta: {
      type: Date,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    price: Number,

    lastLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },

    locationHistory: [
      {
        lat: Number,
        lng: Number,
        updatedAt: Date,
      },
    ],

    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "paystack", "cash"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    proofOfPaymentUrl: String,
  },
  {
    timestamps: true,
  }
);

const Order =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;