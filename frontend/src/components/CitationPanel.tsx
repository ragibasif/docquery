"use client";

import { X, BookOpen } from "lucide-react";

interface Citation {
  chunk_index: number;
  text: string;
  page: number;
}

interface CitationPanelProps {
  citation: Citation;
  onClose: () => void;
}

export default function CitationPanel({ citation, onClose }: CitationPanelProps) {
  return (
    <aside className="w-80 bg-base-200 border-l border-base-300 flex flex-col">
      <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-base-content">Source</h3>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-info/10 text-info rounded-lg p-3 mb-3">
          <p className="text-xs font-medium">
            Page {citation.page} · Chunk {citation.chunk_index}
          </p>
        </div>

        <p className="text-sm text-base-content leading-relaxed">
          {citation.text}
        </p>
      </div>
    </aside>
  );
}
