import Twilio from "twilio";

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;

const FROM = process.env.TWILIO_PHONE_NUMBER;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER;

let client: any = null;

if (SID && TOKEN) {
  try {
    client = Twilio(SID, TOKEN);
  } catch (err) {
    console.error("Failed to initialize Twilio client:", err);
  }
}

function normalizePhoneNumber(to: string): string | null {
  let phone = to.trim();

  if (!phone) {
    return null;
  }

  phone = phone.replace(/^whatsapp:/i, "");
  phone = phone.replace(/[^\d+]/g, "");

  if (!phone) {
    return null;
  }

  if (phone.startsWith("00")) {
    phone = `+${phone.substring(2)}`;
  }

  if (!phone.startsWith("+")) {
    phone = `+${phone}`;
  }

  return phone;
}

export async function sendSms(
  to: string,
  body: string
): Promise<void> {
  if (!client || !FROM) {
    console.warn("Twilio SMS not configured; skipping SMS send.");
    return;
  }

  const normalizedTo = normalizePhoneNumber(to);

  if (!normalizedTo) {
    console.warn("Could not normalize SMS recipient; skipping SMS send.");
    return;
  }

  try {
    await client.messages.create({
      to: normalizedTo,
      from: FROM,
      body,
    });

    console.log(`SMS successfully sent to ${normalizedTo}`);
  } catch (err) {
    console.error(`sendSms failed for ${normalizedTo}`, err);
  }
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<void> {
  if (!client || !WHATSAPP_FROM) {
    console.warn("Twilio WhatsApp not configured; skipping WhatsApp send.");
    return;
  }

  const normalizedTo = normalizePhoneNumber(to);

  if (!normalizedTo) {
    console.warn("Could not normalize WhatsApp recipient; skipping WhatsApp send.");
    return;
  }

  const whatsappTo = `whatsapp:${normalizedTo}`;
  const whatsappFrom = WHATSAPP_FROM.startsWith("whatsapp:")
    ? WHATSAPP_FROM
    : `whatsapp:${WHATSAPP_FROM}`;

  try {
    await client.messages.create({
      to: whatsappTo,
      from: whatsappFrom,
      body,
    });

    console.log(`WhatsApp successfully sent to ${whatsappTo}`);
  } catch (err) {
    console.error(`sendWhatsApp failed for ${whatsappTo}`, err);
  }
}

export default {
  sendSms,
  sendWhatsApp,
};
