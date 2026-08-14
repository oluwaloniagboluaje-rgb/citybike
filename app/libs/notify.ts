import Twilio from "twilio";

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_PHONE_NUMBER; // E.164, e.g. +1234567890
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+1234567890

let client: Twilio.Twilio | null = null;
if (SID && TOKEN) client = Twilio(SID, TOKEN);

export async function sendSms(to: string, body: string) {
  if (!client || !FROM) {
    console.warn("Twilio SMS not configured; skipping SMS send.");
    return;
  }
  try {
    await client.messages.create({ to, from: FROM, body });
  } catch (err) {
    console.error("sendSms failed", err);
  }
}

export async function sendWhatsApp(to: string, body: string) {
  if (!client || !WHATSAPP_FROM) {
    console.warn("Twilio WhatsApp not configured; skipping WhatsApp send.");
    return;
  }
  try {
    await client.messages.create({ to: `whatsapp:${to.replace(/^whatsapp:/, "")}`, from: WHATSAPP_FROM, body });
  } catch (err) {
    console.error("sendWhatsApp failed", err);
  }
}

export default { sendSms, sendWhatsApp };
