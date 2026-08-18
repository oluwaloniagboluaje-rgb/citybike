import mongoose, {
  Schema,
  Document,
  Types,
} from "mongoose";

/* =========================================================
   ORDER STATUS
========================================================= */

export const ORDER_STATUSES = [
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
] as const;

export type OrderStatus =
  (typeof ORDER_STATUSES)[number];

/* =========================================================
   SERVICE TYPE
========================================================= */

export const SERVICE_TYPES = [
  "local",
  "interstate",
  "international",
  "dhl_express",
  "ecommerce",
  "errand",
  "corporate",
] as const;

export type ServiceType =
  (typeof SERVICE_TYPES)[number];

/* =========================================================
   PAYMENT METHOD
========================================================= */

export const PAYMENT_METHODS = [
  "bank_transfer",
  "paystack",
  "cash",
] as const;

export type PaymentMethod =
  (typeof PAYMENT_METHODS)[number];

/* =========================================================
   PAYMENT STATUS
========================================================= */

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
] as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[number];

/* =========================================================
   DHL STATUS
========================================================= */

export const DHL_STATUSES = [
  "shipment_picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery_attempt",
  "returned",
  "customs_cleared",
  "exception",
] as const;

export type DHLStatus =
  (typeof DHL_STATUSES)[number];

/* =========================================================
   INTERNATIONAL STATUS
========================================================= */

export const INTERNATIONAL_STATUSES = [
  "shipment_picked_up",
  "in_transit",
  "cleared_customs",
  "out_for_delivery",
  "delivered",
  "delayed",
  "exception",
] as const;

export type InternationalStatus =
  (typeof INTERNATIONAL_STATUSES)[number];

/* =========================================================
   PACKAGE SIZE
========================================================= */

export const PACKAGE_SIZES = [
  "small",
  "medium",
  "large",
] as const;

export type PackageSize =
  (typeof PACKAGE_SIZES)[number];

/* =========================================================
   LOCATION
========================================================= */

export interface ILocationPoint {
  address: string;
  city: string;
  country: string;
  state?: string;
  postalCode?: string;
  lat: number;
  lng: number;
}

/* =========================================================
   STATUS HISTORY
========================================================= */

export interface IStatusHistoryEntry {
  status: OrderStatus;
  at: Date;
  description?: string;
}

/* =========================================================
   DHL STATUS HISTORY
========================================================= */

export interface IDHLStatusHistoryEntry {
  status: DHLStatus;
  at: Date;
  description?: string;
}

/* =========================================================
   INTERNATIONAL STATUS HISTORY
========================================================= */

export interface IInternationalStatusHistoryEntry {
  status: InternationalStatus;
  at: Date;
  description?: string;
}

/* =========================================================
   LOCATION HISTORY
========================================================= */

export interface ILocationHistoryEntry {
  lat: number;
  lng: number;
  updatedAt: Date;
}

/* =========================================================
   LAST LOCATION
========================================================= */

export interface ILastLocation {
  lat: number;
  lng: number;
  updatedAt: Date;
}

/* =========================================================
   ORDER INTERFACE
========================================================= */

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

  packageSize: PackageSize;

  weightKg?: number;

  recipientName: string;
  recipientPhone: string;
  recipientPhoneCode?: string;

  pickupTime: Date;
  eta?: Date;

  status: OrderStatus;

  statusHistory: IStatusHistoryEntry[];

  dhlStatusHistory: IDHLStatusHistoryEntry[];

  internationalStatusHistory:
    IInternationalStatusHistoryEntry[];

  price?: number;

  lastLocation?: ILastLocation;

  locationHistory: ILocationHistoryEntry[];

  paymentMethod: PaymentMethod;

  paymentStatus: PaymentStatus;

  proofOfPaymentUrl?: string;

  pickupPhotoUrl?: string;

  deliveryPhotoUrl?: string;

  externalTrackingNumber?: string;

  carrierName?: string;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   LOCATION POINT SCHEMA
========================================================= */

const LocationPointSchema =
  new Schema<ILocationPoint>(
    {
      address: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        required: true,
        default: "Nigeria",
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },

      postalCode: {
        type: String,
        trim: true,
      },

      lat: {
        type: Number,
        required: true,
      },

      lng: {
        type: Number,
        required: true,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   STATUS HISTORY SCHEMA
========================================================= */

const StatusHistorySchema =
  new Schema<IStatusHistoryEntry>(
    {
      status: {
        type: String,
        enum: ORDER_STATUSES,
        required: true,
      },

      at: {
        type: Date,
        default: Date.now,
        required: true,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   DHL STATUS HISTORY SCHEMA
========================================================= */

const DHLStatusHistorySchema =
  new Schema<IDHLStatusHistoryEntry>(
    {
      status: {
        type: String,
        enum: DHL_STATUSES,
        required: true,
      },

      at: {
        type: Date,
        default: Date.now,
        required: true,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   INTERNATIONAL STATUS HISTORY SCHEMA
========================================================= */

const InternationalStatusHistorySchema =
  new Schema<IInternationalStatusHistoryEntry>(
    {
      status: {
        type: String,
        enum: INTERNATIONAL_STATUSES,
        required: true,
      },

      at: {
        type: Date,
        default: Date.now,
        required: true,
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   LOCATION HISTORY SCHEMA
========================================================= */

const LocationHistorySchema =
  new Schema<ILocationHistoryEntry>(
    {
      lat: {
        type: Number,
        required: true,
      },

      lng: {
        type: Number,
        required: true,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
        required: true,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   LAST LOCATION SCHEMA
========================================================= */

const LastLocationSchema =
  new Schema<ILastLocation>(
    {
      lat: {
        type: Number,
        required: true,
      },

      lng: {
        type: Number,
        required: true,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
        required: true,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   ORDER SCHEMA
========================================================= */

const OrderSchema =
  new Schema<IOrder>(
    {
      /* =====================================================
         TRACKING NUMBER
      ===================================================== */

      trackingNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true,
      },

      /* =====================================================
         CUSTOMER
      ===================================================== */

      customer: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },

      /* =====================================================
         SENDER
      ===================================================== */

      senderName: {
        type: String,
        trim: true,
      },

      senderPhone: {
        type: String,
        trim: true,
      },

      isAdminCreated: {
        type: Boolean,
        default: false,
      },

      /* =====================================================
         DRIVER
      ===================================================== */

      driver: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },

      /* =====================================================
         PICKUP
      ===================================================== */

      pickup: {
        type: LocationPointSchema,
        required: true,
      },

      /* =====================================================
         DROPOFF
      ===================================================== */

      dropoff: {
        type: LocationPointSchema,
        required: true,
      },

      /* =====================================================
         SERVICE TYPE
      ===================================================== */

      serviceType: {
        type: String,
        enum: SERVICE_TYPES,
        default: "local",
        required: true,
      },

      isInternational: {
        type: Boolean,
        default: false,
        required: true,
      },

      /* =====================================================
         PACKAGE
      ===================================================== */

      packageDescription: {
        type: String,
        required: true,
        trim: true,
      },

      packageSize: {
        type: String,
        enum: PACKAGE_SIZES,
        default: "small",
        required: true,
      },

      weightKg: {
        type: Number,
        min: 0,
      },

      /* =====================================================
         RECIPIENT
      ===================================================== */

      recipientName: {
        type: String,
        required: true,
        trim: true,
      },

      recipientPhone: {
        type: String,
        required: true,
        trim: true,
      },

      recipientPhoneCode: {
        type: String,
        trim: true,
      },

      /* =====================================================
         DATES
      ===================================================== */

      pickupTime: {
        type: Date,
        default: Date.now,
        required: true,
      },

      eta: {
        type: Date,
      },

      /* =====================================================
         CURRENT STATUS
      ===================================================== */

      status: {
        type: String,
        enum: ORDER_STATUSES,
        default: "pending",
        required: true,
      },

      /* =====================================================
         STATUS HISTORY
      ===================================================== */

      statusHistory: {
        type: [StatusHistorySchema],
        default: [],
      },

      /* =====================================================
         DHL STATUS HISTORY
      ===================================================== */

      dhlStatusHistory: {
        type: [DHLStatusHistorySchema],
        default: [],
      },

      /* =====================================================
         INTERNATIONAL STATUS HISTORY
      ===================================================== */

      internationalStatusHistory: {
        type: [
          InternationalStatusHistorySchema,
        ],
        default: [],
      },

      /* =====================================================
         PRICE
      ===================================================== */

      price: {
        type: Number,
        min: 0,
      },

      /* =====================================================
         CURRENT DRIVER LOCATION
      ===================================================== */

      lastLocation: {
        type: LastLocationSchema,
      },

      /* =====================================================
         LOCATION HISTORY
      ===================================================== */

      locationHistory: {
        type: [LocationHistorySchema],
        default: [],
      },

      /* =====================================================
         PAYMENT METHOD
      ===================================================== */

      paymentMethod: {
        type: String,
        enum: PAYMENT_METHODS,
        required: true,
      },

      /* =====================================================
         PAYMENT STATUS
      ===================================================== */

      paymentStatus: {
        type: String,
        enum: PAYMENT_STATUSES,
        default: "pending",
        required: true,
      },

      /* =====================================================
         PAYMENT PROOF
      ===================================================== */

      proofOfPaymentUrl: {
        type: String,
        trim: true,
      },

      /* =====================================================
         PICKUP PHOTO
      ===================================================== */

      pickupPhotoUrl: {
        type: String,
        trim: true,
      },

      /* =====================================================
         DELIVERY PHOTO
      ===================================================== */

      deliveryPhotoUrl: {
        type: String,
        trim: true,
      },

      /* =====================================================
         EXTERNAL TRACKING NUMBER
      ===================================================== */

      externalTrackingNumber: {
        type: String,
        trim: true,
      },

      /* =====================================================
         CARRIER NAME
      ===================================================== */

      carrierName: {
        type: String,
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

/* =========================================================
   MODEL
========================================================= */

const Order =
  mongoose.models.Order ||
  mongoose.model<IOrder>(
    "Order",
    OrderSchema
  );

export default Order;