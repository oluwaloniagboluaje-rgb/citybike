import mongoose, { Schema, Document, Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "shipment_created"
  | "awaiting_batching"
  | "added_to_batch"
  | "ready_for_shipping"
  | "left_origin"
  | "in_transit"
  | "landed"
  | "customs_processing"
  | "confirmed"
  | "assigned"
  | "assigned_courier"
  | "picked_up"
  | "awaiting_dispatch"
  | "dispatched"
  | "destination_hub"
  | "out_for_delivery"
  | "delivered_by_courier"
  | "delivery_confirmed"
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

export type DHLStatus =
  | "shipment_picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery_attempt"
  | "returned"
  | "customs_cleared"
  | "exception";

export interface ILocationPoint {
  address: string;
  city: string;
  country: string;
  state?: string;
  postalCode?: string;
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
  recipientPhoneCode?: string;
  pickupTime: Date;
  eta?: Date;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date }[];
  dhlStatusHistory?: { status: DHLStatus; at: Date; description?: string }[];
  price?: number;
  lastLocation?: { lat: number; lng: number; updatedAt: Date };
  locationHistory?: { lat: number; lng: number; updatedAt: Date }[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  proofOfPaymentUrl?: string;
  pickupPhotoUrl?: string;
  deliveryPhotoUrl?: string;
  // Internal reference to the tracking number issued by an external
  // carrier (e.g. DHL) actually handling the physical shipment. Never
  // exposed to the customer or on the public tracking page — customers
  // only ever see the CityBike tracking number.
  externalTrackingNumber?: string;
  carrierName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationPointSchema = new Schema<ILocationPoint>(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true, default: "Nigeria" },
    state: { type: String },
    postalCode: { type: String },
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

    recipientPhoneCode: { type: String },

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
        "shipment_created",
        "awaiting_batching",
        "added_to_batch",
        "ready_for_shipping",
        "left_origin",
        "in_transit",
          "landed",
          "customs_processing",
        "confirmed",
        "assigned",
        "assigned_courier",
        "picked_up",
        "awaiting_dispatch",
        "dispatched",
        "destination_hub",
        "out_for_delivery",
        "delivered_by_courier",
        "delivery_confirmed",
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

    dhlStatusHistory: [
      {
        status: {
          type: String,
          enum: [
            "shipment_picked_up",
            "in_transit",
            "out_for_delivery",
            "delivered",
            "failed_delivery_attempt",
            "returned",
            "customs_cleared",
            "exception",
          ],
        },
        at: {
          type: Date,
          default: Date.now,
        },
        description: String,
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

    pickupPhotoUrl: String,
    deliveryPhotoUrl: String,

    externalTrackingNumber: String,
    carrierName: String,
  },
  {
    timestamps: true,
  }
);

const Order =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;