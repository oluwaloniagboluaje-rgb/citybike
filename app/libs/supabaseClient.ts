import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// --- Channel name helpers (keep these consistent across the app) ---

export const orderLocationChannel = (orderId: string) =>
  `order-location-${orderId}`;

export const orderChatChannel = (orderId: string) =>
  `order-chat-${orderId}`;

export const orderStatusChannel = (orderId: string) =>
  `order-status-${orderId}`;

export const driverNotificationChannel = (driverId: string) =>
  `driver-notifications-${driverId}`;

export const ADMIN_NOTIFICATIONS_CHANNEL = "admin-notifications";