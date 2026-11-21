export interface MarketingEmailContent {
  name: string;
  subject: string;
  message: string;
  imageUrl?: string;
  imageLink?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  discountCode?: string;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://citybikelogistic.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function renderMarketingEmail(
  content: MarketingEmailContent,
  unsubscribeUrl: string
): string {
  const imageUrl = safeHttpUrl(content.imageUrl);
  const imageLink = safeHttpUrl(content.imageLink);
  const ctaUrl = safeHttpUrl(content.ctaUrl);
  const unsubscribe = safeHttpUrl(unsubscribeUrl);
  const image = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="CityBike Logistics promotion" style="display:block;width:100%;height:auto;border:0;border-radius:12px;" />`
    : "";
  const linkedImage =
    image && imageLink
      ? `<a href="${escapeHtml(imageLink)}" style="display:block;">${image}</a>`
      : image;
  const message = escapeHtml(content.message).replace(/\r?\n/g, "<br />");
  const cta =
    ctaUrl && content.ctaLabel
      ? `<p style="margin:28px 0;text-align:center;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#ea580c;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:700;">${escapeHtml(content.ctaLabel)}</a></p>`
      : "";
  const discount = content.discountCode
    ? `<div style="margin:24px 0;padding:16px;border:1px dashed #ea580c;border-radius:8px;text-align:center;"><p style="margin:0 0 8px;color:#7c2d12;">Special offer</p><strong style="font-size:20px;letter-spacing:2px;color:#c2410c;">${escapeHtml(content.discountCode)}</strong></div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta charset="utf-8" /></head>
  <body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#262626;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f4;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:22px 28px;background:#111827;color:#fff;">
            <img src="${escapeHtml(`${APP_URL}/citybike-logo.jpeg`)}" alt="CityBike Logistics" width="48" height="48" style="vertical-align:middle;border-radius:8px;margin-right:12px;" />
            <strong style="font-size:18px;">CityBike <span style="color:#f97316;">Logistics</span></strong>
          </td></tr>
          <tr><td style="padding:30px 28px;">
            <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#171717;">${escapeHtml(content.name)}</h1>
            ${linkedImage ? `<div style="margin:0 0 24px;">${linkedImage}</div>` : ""}
            <div style="font-size:16px;line-height:1.7;color:#404040;">${message}</div>
            ${discount}
            ${cta}
          </td></tr>
          <tr><td style="padding:22px 28px;background:#fafaf9;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.7;color:#737373;">
            <strong style="color:#404040;">CityBike Logistics</strong><br />
            Opposite Jaiz Bank, Molete, Ibadan<br />
            <a href="mailto:info@citybikelogistics.com" style="color:#c2410c;">info@citybikelogistics.com</a> ·
            <a href="tel:+2349152661473" style="color:#c2410c;">0915 266 1473</a><br />
            You are receiving this message because you agreed to receive marketing emails from CityBike Logistics.
            ${unsubscribe ? `<br /><a href="${escapeHtml(unsubscribe)}" style="color:#737373;">Unsubscribe from marketing emails</a>` : ""}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function marketingAppUrl(path: string): string {
  return `${APP_URL}${path}`;
}

export function escapeCampaignText(value: string): string {
  return escapeHtml(value);
}

export function getCampaignPlainText(
  content: MarketingEmailContent,
  unsubscribeUrl: string
): string {
  return [
    content.name,
    "",
    content.message,
    content.discountCode ? `Special offer: ${content.discountCode}` : "",
    content.ctaUrl && content.ctaLabel
      ? `${content.ctaLabel}: ${content.ctaUrl}`
      : "",
    "",
    "CityBike Logistics · Opposite Jaiz Bank, Molete, Ibadan",
    "info@citybikelogistics.com · 0915 266 1473",
    `Unsubscribe: ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}
