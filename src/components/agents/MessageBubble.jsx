import React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";
import FunctionDisplay from "./FunctionDisplay";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isUser ? "bg-primary/10" : "bg-secondary border border-border"}`}>
        {isUser ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : "text-left"}`}>
        {message.content && (
          isUser ? (
            <div className="inline-block rounded-lg bg-primary/10 px-4 py-2 text-sm text-foreground">
              {message.content}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <ReactMarkdown className="prose prose-sm prose-invert max-w-none text-sm text-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_code]:text-primary [&_code]:bg-secondary/60 [&_code]:px-1 [&_code]:rounded">
                {message.content}
              </ReactMarkdown>
            </div>
          )
        )}
        {message.tool_calls?.map((toolCall, idx) => (
          <FunctionDisplay key={idx} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}