"use client";

import ReactMarkdown from "react-markdown";
import { User, Bot } from "lucide-react";

interface Citation {
  chunk_index: number;
  text: string;
  page: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface ChatMessageProps {
  message: Message;
  onCitationClick: (citation: Citation) => void;
}

export default function ChatMessage({ message, onCitationClick }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
      <div className="chat-image avatar">
        <div
          className={`w-8 rounded-full flex items-center justify-center ${
            isUser ? "bg-base-300" : "bg-primary/20"
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 text-base-content" />
          ) : (
            <Bot className="w-4 h-4 text-primary" />
          )}
        </div>
      </div>

      <div className={`chat-bubble ${isUser ? "chat-bubble-primary" : "bg-base-200"}`}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="text-sm text-base-content prose prose-sm max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-base-300">
            {message.citations.map((citation, i) => (
              <button
                key={i}
                onClick={() => onCitationClick(citation)}
                className="badge badge-primary badge-soft cursor-pointer hover:opacity-80 transition-opacity"
              >
                [{i + 1}] p.{citation.page}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
