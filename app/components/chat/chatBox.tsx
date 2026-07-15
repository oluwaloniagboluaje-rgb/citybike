"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, orderChatChannel } from "@/libs/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { MessageClient } from "@/types";
import { Send } from "lucide-react";
import { RealtimeChannel } from "@supabase/supabase-js";


export default function ChatBox({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageClient[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load history + subscribe to realtime broadcast
  useEffect(() => {
    let active = true;

    (async () => {
      const res = await fetch(`/api/message/${orderId}`);
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    })();

    const channel = supabase.channel(orderChatChannel(orderId));
    channel
      .on("broadcast", { event: "message" }, (payload) => {
        setMessages((prev) => [...prev, payload.payload as MessageClient]);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const body = text.trim();
    setText("");

    try {
      const res = await fetch(`/api/message/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      if (res.ok) {
        const data = await res.json();
        // Broadcast to other participants in real time
        channelRef.current?.send({
          type: "broadcast",
          event: "message",
          payload: data.message,
        });
        // Add locally too (broadcast doesn't echo back to sender by default)
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-96 flex-col rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700">
        Order Chat
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400">
            No messages yet. Say hello 👋
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.sender === user?.userId;
          return (
            <div
              key={m._id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                  isMe
                    ? "bg-orange-600 text-white"
                    : "bg-neutral-100 text-neutral-800"
                }`}
              >
                {m.text}
              </div>
              <span className="mt-0.5 text-[11px] text-neutral-400">
                {isMe ? "You" : `${m.senderName} (${m.senderRole})`}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-neutral-200 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex items-center justify-center rounded-md bg-orange-600 px-3 py-1.5 text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}