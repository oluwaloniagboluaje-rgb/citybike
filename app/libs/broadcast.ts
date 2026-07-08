import { supabase, ADMIN_NOTIFICATIONS_CHANNEL } from "./supabaseClient";

export { ADMIN_NOTIFICATIONS_CHANNEL };

export async function serverBroadcast(
  channelName: string,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) {
  try {
    const channel = supabase.channel(channelName);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event, payload }).then(() => {
            supabase.removeChannel(channel);
            resolve();
          });
        }
      });
      setTimeout(() => resolve(), 3000);
    });
  } catch (err) {
    console.error("serverBroadcast failed", err);
  }
}