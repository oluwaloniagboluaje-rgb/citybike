// import Twilio from "twilio";

// const SID = process.env.TWILIO_ACCOUNT_SID;
// const TOKEN = process.env.TWILIO_AUTH_TOKEN;

// const FROM = process.env.TWILIO_PHONE_NUMBER;
// // Example: +1234567890

// const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER;
// // Example: whatsapp:+1234567890

// let client: Twilio.Twilio | null = null;

// if (SID && TOKEN) {
//   client = Twilio(SID, TOKEN);
// }


// function normalizePhoneNumber(to: string): string {
//   let phone = to.trim();

//   // Remove whatsapp: prefix if someone accidentally passes it.
//   phone = phone.replace(/^whatsapp:/i, "");

//   // Remove spaces, brackets, hyphens, dots, etc.
//   phone = phone.replace(/[^\d+]/g, "");

//   // Convert 00 international dialing format to +.
//   if (phone.startsWith("00")) {
//     phone = `+${phone.substring(2)}`;
//   }

//   // Ensure + is present for international numbers.
//   if (!phone.startsWith("+")) {
//     phone = `+${phone}`;
//   }

//   return phone;
// }

// /**
//  * Send SMS through Twilio.
//  */
// export async function sendSms(
//   to: string,
//   body: string
// ) {
//   if (!client || !FROM) {
//     console.warn(
//       "Twilio SMS not configured; skipping SMS send."
//     );
//     return;
//   }

//   const normalizedTo = normalizePhoneNumber(to);

//   try {
//     console.log(
//       `Sending SMS to ${normalizedTo}`
//     );

//     await client.messages.create({
//       to: normalizedTo,
//       from: FROM,
//       body,
//     });

//     console.log(
//       `SMS successfully sent to ${normalizedTo}`
//     );
//   } catch (err) {
//     console.error(
//       `sendSms failed for ${normalizedTo}`,
//       err
//     );
//   }
// }

// /**
//  * Send WhatsApp message through Twilio.
//  *
//  * Twilio expects:
//  *
//  * to:   whatsapp:+447123456789
//  * from: whatsapp:+14155238886
//  */
// export async function sendWhatsApp(
//   to: string,
//   body: string
// ) {
//   if (!client || !WHATSAPP_FROM) {
//     console.warn(
//       "Twilio WhatsApp not configured; skipping WhatsApp send."
//     );
//     return;
//   }

//   const normalizedTo =
//     normalizePhoneNumber(to);

//   const whatsappTo =
//     `whatsapp:${normalizedTo}`;

//   const whatsappFrom =
//     WHATSAPP_FROM.startsWith("whatsapp:")
//       ? WHATSAPP_FROM
//       : `whatsapp:${WHATSAPP_FROM}`;

//   try {
//     console.log(
//       `Sending WhatsApp to ${whatsappTo}`
//     );

//     await client.messages.create({
//       to: whatsappTo,
//       from: whatsappFrom,
//       body,
//     });

//     console.log(
//       `WhatsApp successfully sent to ${whatsappTo}`
//     );
//   } catch (err) {
//     console.error(
//       `sendWhatsApp failed for ${whatsappTo}`,
//       err
//     );
//   }
// }

// export default {
//   sendSms,
//   sendWhatsApp,
// };


/**
 * Notification helpers
 *
 * SMS and WhatsApp notifications are currently DISABLED.
 *
 * These functions are kept so the rest of the application can continue
 * calling sendSms() and sendWhatsApp() without errors.
 *
 * Twilio can be enabled again later without changing the rest of the app.
 */

export async function sendSms(
  to: string,
  body: string
): Promise<void> {
  console.log(
    `[SMS disabled] Would send SMS to ${to}: ${body}`
  );
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<void> {
  console.log(
    `[WhatsApp disabled] Would send WhatsApp to ${to}: ${body}`
  );
}

export default {
  sendSms,
  sendWhatsApp,
};