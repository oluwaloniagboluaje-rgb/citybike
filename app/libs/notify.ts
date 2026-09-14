import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

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
  const normalizedTo = normalizePhoneNumber(to);

  if (!normalizedTo) {
    console.warn("Could not normalize SMS recipient; skipping SMS send.");
    return;
  }

  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.warn("Twilio SMS not configured; skipping message send.");
    return;
  }

  try {
    await twilioClient.messages.create({
      body,
      from: TWILIO_PHONE_NUMBER,
      to: normalizedTo,
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
  const normalizedTo = normalizePhoneNumber(to);

  if (!normalizedTo) {
    console.warn("Could not normalize WhatsApp recipient; skipping WhatsApp send.");
    return;
  }

  if (!twilioClient || !(TWILIO_WHATSAPP_NUMBER || TWILIO_PHONE_NUMBER)) {
    console.warn("Twilio WhatsApp not configured; skipping message send.");
    return;
  }

  try {
    const whatsappFrom = TWILIO_WHATSAPP_NUMBER || TWILIO_PHONE_NUMBER || "";

    if (!whatsappFrom) {
      console.warn("Twilio WhatsApp sender not configured; skipping message send.");
      return;
    }

    await twilioClient.messages.create({
      body,
      from: `whatsapp:${whatsappFrom.replace(/^whatsapp:/i, "")}`,
      to: `whatsapp:${normalizedTo.replace(/^whatsapp:/i, "")}`,
    });

    console.log(`WhatsApp successfully sent to ${normalizedTo}`);
  } catch (err) {
    console.error(`sendWhatsApp failed for ${normalizedTo}`, err);
  }
}

export default {
  sendSms,
  sendWhatsApp,
};
