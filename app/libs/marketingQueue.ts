import { Client } from "@upstash/qstash";

export interface MarketingDispatch {
  campaignId: string;
  scheduledAt: number;
  batchNumber: number;
}

let qstashClient: Client | null = null;

function getQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("Campaign scheduling requires QSTASH_TOKEN.");
  }
  if (!qstashClient) qstashClient = new Client({ token });
  return qstashClient;
}

export function getMarketingDispatchUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("Campaign scheduling requires NEXT_PUBLIC_APP_URL.");
  }
  const url = new URL("/api/marketing/dispatch", baseUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Campaign dispatch requires an HTTPS app URL.");
  }
  return url.toString();
}

export async function publishMarketingDispatch(options: {
  dispatch: MarketingDispatch;
  notBefore?: Date;
  retry?: boolean;
}): Promise<void> {
  const { dispatch, notBefore, retry = false } = options;
  const retrySuffix = retry
    ? `-retry-${Math.floor(Date.now() / 60_000)}`
    : "";
  const deduplicationId =
    `citybike-${dispatch.campaignId}-${dispatch.scheduledAt}` +
    `-batch-${dispatch.batchNumber}${retrySuffix}`;

  await getQStashClient().publishJSON({
    url: getMarketingDispatchUrl(),
    body: dispatch,
    deduplicationId,
    ...(notBefore
      ? { notBefore: Math.ceil(notBefore.getTime() / 1000) }
      : {}),
  });
}
