import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, Sparkles, Bot } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MessageBubble from "@/components/agents/MessageBubble";

export default function AgentChat({ agent }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let unsubscribe = null;
    async function init() {
      setIsStarting(true);
      try {
        const conv = await base44.agents.createConversation({
          agent_name: agent.id,
          metadata: { name: agent.label, description: agent.description },
        });
        setConversation(conv);
        setMessages(conv.messages || []);
        unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
          setMessages(data.messages || []);
        });
      } catch (err) {
        console.error("Agent init error:", err);
      } finally {
        setIsStarting(false);
      }
    }
    init();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [agent.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !conversation || isSending) return;
    const content = input.trim();
    setInput("");
    setIsSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: "user", content });
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Agent header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border">
          {agent.icon ? <agent.icon className="h-5 w-5 text-primary" /> : <Bot className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading text-sm font-semibold text-foreground">{agent.label}</div>
          <div className="text-xs text-muted-foreground truncate">{agent.description}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${isStarting ? "bg-warning animate-pulse" : "bg-profit"}`} />
          <span className="font-mono text-xs text-muted-foreground">{isStarting ? "initializing" : "ready"}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {isStarting && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Agent wird initialisiert…</span>
          </div>
        )}
        {!isStarting && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-center">
            <Sparkles className="h-8 w-8 text-primary/50" />
            <div className="text-sm max-w-xs">{agent.prompt || `Frage ${agent.label} anything über das Trading-System.`}</div>
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Nachricht an ${agent.label}…`}
            disabled={isSending || isStarting}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || isStarting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed glow-cyan"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}