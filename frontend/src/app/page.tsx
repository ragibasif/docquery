"use client";

import { useState, useRef, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import ChatMessage from "@/components/ChatMessage";
import CitationPanel from "@/components/CitationPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { Send, FileText, Loader2, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Document {
  id: string;
  name: string;
  chunk_count: number;
}

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

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/documents`);
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Upload failed");
      }

      const doc = await res.json();
      setDocuments((prev) => [...prev, doc]);
      setActiveDoc(doc);
      setMessages([]);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAsk = async () => {
    if (!input.trim() || !activeDoc || isAsking) return;

    const question = input.trim();
    setInput("");

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setIsAsking(true);

    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: activeDoc.id,
          question,
          conversation_history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to get answer");
      }

      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, something went wrong: ${err.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await fetch(`${API_URL}/documents/${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (activeDoc?.id === docId) {
        setActiveDoc(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="flex h-screen bg-base-100">
      {/* Sidebar */}
      <aside className="w-72 bg-base-200 border-r border-base-300 flex flex-col">
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-base-content">DocQuery</h1>
            <p className="text-sm text-base-content/60 mt-1">AI-Powered Document Q&A</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4">
          <FileUpload onUpload={handleUpload} isUploading={isUploading} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            Documents
          </h2>
          {documents.length === 0 ? (
            <p className="text-sm text-base-content/50">No documents uploaded yet</p>
          ) : (
            <ul className="space-y-1">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    activeDoc?.id === doc.id
                      ? "bg-base-300 text-primary"
                      : "hover:bg-base-300 text-base-content"
                  }`}
                  onClick={() => {
                    setActiveDoc(doc);
                    setMessages([]);
                    setSelectedCitation(null);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm truncate">{doc.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoc(doc.id);
                    }}
                    className="btn btn-ghost btn-xs text-error flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {!activeDoc ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-base-content">
                Upload a document to get started
              </h2>
              <p className="text-base-content/50 mt-2">
                Upload a PDF and ask questions about its content
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 border-b border-base-300 bg-base-100">
              <h2 className="font-semibold text-base-content">{activeDoc.name}</h2>
              <p className="text-xs text-base-content/50">
                {activeDoc.chunk_count} chunks indexed
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-base-content/50 mt-20">
                  <p className="text-lg">Ask a question about this document</p>
                  <p className="text-sm mt-1">
                    Try: &quot;What is the main topic of this document?&quot;
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={msg}
                  onCitationClick={(citation) => setSelectedCitation(citation)}
                />
              ))}

              {isAsking && (
                <div className="flex items-center gap-2 text-base-content/50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Searching document and generating answer...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="px-6 py-4 border-t border-base-300 bg-base-100">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about the document..."
                  className="textarea w-full resize-none max-h-32"
                  rows={1}
                />
                <button
                  onClick={handleAsk}
                  disabled={!input.trim() || isAsking}
                  className="btn btn-primary btn-square"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Citation Side Panel */}
      {selectedCitation && (
        <CitationPanel
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </div>
  );
}
