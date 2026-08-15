export type UserRole = "customer" | "admin" | "driver";

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

export interface LocationPoint {
  address: string;
  city: string;
  country: string;
  state?: string;
  postalCode?: string;
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
  recipientPhoneCode?: string;
  pickupTime: string;
  eta?: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  dhlStatusHistory?: { status: DHLStatus; at: string; description?: string }[];
  price?: number;
  lastLocation?: { lat: number; lng: number; updatedAt: string };
  locationHistory?: { lat: number; lng: number; updatedAt: string }[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  proofOfPaymentUrl?: string;
  pickupPhotoUrl?: string;
  deliveryPhotoUrl?: string;
  externalTrackingNumber?: string;
  carrierName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTrackingResult {
  id?: string;
  trackingNumber: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  dhlStatusHistory?: { status: DHLStatus; at: string; description?: string }[];
  externalTrackingNumber?: string;
  carrierName?: string;
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
  pending: "Pending",
  shipment_created: "Shipment Created",
  awaiting_batching: "Awaiting Batching",
  added_to_batch: "Added to Batch",
  ready_for_shipping: "Ready for Shipping",
  left_origin: "Left Origin",
  in_transit: "In Transit",
  landed: "Landed at Destination",
  customs_processing: "Customs Processing",
  confirmed: "Confirmed - Awaiting Driver",
  assigned: "Driver Assigned",
  assigned_courier: "Courier Assigned",
  picked_up: "Package Picked Up",
  awaiting_dispatch: "Awaiting Dispatch",
  dispatched: "Dispatched",
  destination_hub: "Destination Hub",
  out_for_delivery: "Out for Delivery",
  delivered_by_courier: "Delivered by Courier",
  delivery_confirmed: "Delivery Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  shipment_created: "bg-yellow-100 text-yellow-800",
  awaiting_batching: "bg-yellow-100 text-yellow-800",
  added_to_batch: "bg-yellow-100 text-yellow-800",
  ready_for_shipping: "bg-blue-100 text-blue-800",
  left_origin: "bg-orange-100 text-orange-800",
  in_transit: "bg-orange-100 text-orange-800",
  landed: "bg-violet-100 text-violet-800",
  customs_processing: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  assigned: "bg-violet-100 text-violet-800",
  assigned_courier: "bg-violet-100 text-violet-800",
  picked_up: "bg-purple-100 text-purple-800",
  awaiting_dispatch: "bg-amber-100 text-amber-800",
  dispatched: "bg-cyan-100 text-cyan-800",
  destination_hub: "bg-indigo-100 text-indigo-800",
  out_for_delivery: "bg-orange-100 text-orange-800",
  delivered_by_courier: "bg-green-100 text-green-800",
  delivery_confirmed: "bg-green-100 text-green-800",
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

export const DHL_STATUS_LABELS: Record<DHLStatus, string> = {
  shipment_picked_up: "Shipment Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  failed_delivery_attempt: "Failed Delivery Attempt",
  returned: "Returned to Shipper",
  customs_cleared: "Customs Cleared",
  exception: "Exception",
};