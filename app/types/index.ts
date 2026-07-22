export type UserRole = "customer" | "admin" | "driver";

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

export interface LocationPoint {
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface OrderClient {
  _id: string;
  trackingNumber: string;
  customer: { _id: string; name: string; phone: string; email: string } | null;
  senderName?: string;
  senderPhone?: string;
  isAdminCreated?: boolean;
  driver?: { _id: string; name: string; phone: string } | null;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  serviceType: ServiceType;
  isInternational: boolean;
  packageDescription: string;
  packageSize: "small" | "medium" | "large";
  weightKg?: number;
  recipientName: string;
  recipientPhone: string;
  pickupTime: string;
  eta?: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  price?: number;
  lastLocation?: { lat: number; lng: number; updatedAt: string };
  locationHistory?: { lat: number; lng: number; updatedAt: string }[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  proofOfPaymentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTrackingResult {
  trackingNumber: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  serviceType: ServiceType;
  isInternational: boolean;
  packageDescription: string;
  recipientName: string;
  pickupTime: string;
  eta?: string;
  pickup: { city: string; country: string; lat: number; lng: number };
  dropoff: { city: string; country: string; lat: number; lng: number };
  locationHistory?: { lat: number; lng: number; updatedAt: string }[];
  lastLocation?: { lat: number; lng: number; updatedAt: string } | null;
  createdAt: string;
}

export interface AuthUser {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
}

export interface MessageClient {
  _id: string;
  order: string;
  sender: string;
  senderRole: UserRole;
  senderName: string;
  text: string;
  createdAt: string;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending Confirmation",
  confirmed: "Confirmed - Awaiting Driver",
  assigned: "Driver Assigned",
  picked_up: "Package Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  assigned: "bg-violet-100 text-violet-800",
  picked_up: "bg-purple-100 text-purple-800",
  in_transit: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  local: "Local Pickup & Delivery",
  interstate: "Interstate Delivery",
  international: "International Cargo Shipping",
  dhl_express: "DHL Express Shipping",
  ecommerce: "E-commerce Fulfillment",
  errand: "Personal / Business Errand",
  corporate: "Corporate Logistics",
};

export const COUNTRY_OPTIONS = [
  "Nigeria",
  "United Kingdom",
  "United States",
  "Canada",
  "United Arab Emirates",
  "Ghana",
  "South Africa",
  "Kenya",
  "Other",
];