"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, MessageCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function ApplicationChat({
  applicationId,
  currentUserId,
  otherName,
  defaultOpen = false,
}: {
  applicationId: string;
  currentUserId: string;
  otherName: string;
  defaultOpen?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const supabase = getSupabaseBrowserClient();

  const loadMessages = useCallback(async () => {
    if (!supabase) return;

    const { data, error: loadError } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(`Chat could not be loaded: ${loadError.message}`);
      return;
    }

    setError("");
    setMessages(data ?? []);
  }, [applicationId, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void loadMessages();
    });
    const interval = window.setInterval(() => void loadMessages(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isOpen, loadMessages]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = body.trim();
    if (!content || sending) return;
    if (!supabase) {
      setError("Chat needs a Supabase connection.");
      return;
    }

    setSending(true);
    setError("");
    const { error: sendError } = await supabase.from("messages").insert({
      application_id: applicationId,
      sender_id: currentUserId,
      body: content,
    });

    if (sendError) {
      setError(`Message could not be sent: ${sendError.message}`);
    } else {
      setBody("");
      await loadMessages();
    }
    setSending(false);
  };

  return (
    <section className="application-chat" aria-label={`Chat with ${otherName}`}>
      <button
        type="button"
        className="application-chat-header"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="chat-icon"><MessageCircle size={17} /></span>
        <span><strong>Keep the conversation going</strong><small>With {otherName}</small></span>
        <ArrowDown className="chat-toggle-icon" size={16} />
      </button>
      {isOpen && (
        <>
          <div className="application-chat-messages" aria-live="polite">
            {messages.length === 0 && !error && supabase && (
              <p className="chat-empty">No messages yet. Say hello and introduce yourself.</p>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chat-message${message.sender_id === currentUserId ? " is-mine" : ""}`}
              >
                <p>{message.body}</p>
                <time dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </time>
              </article>
            ))}
          </div>
          {!supabase && <p className="chat-error" role="alert">Chat needs a Supabase connection.</p>}
          {error && <p className="chat-error" role="alert">{error}</p>}
          <form className="application-chat-form" onSubmit={handleSend}>
            <label className="sr-only" htmlFor={`message-${applicationId}`}>Write a message</label>
            <input
              id={`message-${applicationId}`}
              value={body}
              maxLength={4000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a message…"
            />
            <button type="submit" disabled={!body.trim() || sending} aria-label="Send message">
              <ArrowUp size={17} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
