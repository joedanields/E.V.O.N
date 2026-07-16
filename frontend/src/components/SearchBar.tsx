// ═══════════════════════════════════════════════════════════
//  SearchBar — search across conversations (MISS-003)
// ═══════════════════════════════════════════════════════════

"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Search, X, MessageCircle } from "lucide-react";
import { searchConversations } from "@/lib/api";
import type { SearchResult } from "@/lib/api";

interface Props {
  onSelectConversation: (id: string) => void;
}

export interface SearchBarHandle {
  focus: () => void;
}

const SearchBar = forwardRef<SearchBarHandle, Props>(({ onSelectConversation }, ref) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      setOpen(true);
    },
  }));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchConversations(q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-evon-muted" />
          <input
            ref={inputRef}
            type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search conversations..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-evon-surface border border-evon-border rounded-lg
                     text-evon-text placeholder:text-evon-muted focus:outline-none focus:border-evon-accent
                     transition-colors"
          aria-label="Search conversations"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-evon-card text-evon-muted"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-evon-card border border-evon-border rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {loading && (
              <div className="px-4 py-3 text-sm text-evon-muted text-center">Searching…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-evon-muted text-center">No results found</div>
            )}
            {!loading &&
              results.map((r) => (
                <button
                  key={r.message_id}
                  onClick={() => {
                    onSelectConversation(r.conversation_id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-start gap-2 px-4 py-3 w-full text-left hover:bg-evon-surface transition-colors"
                >
                  <MessageCircle className="w-4 h-4 mt-0.5 text-evon-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-evon-accent truncate">
                      {r.conversation_title}
                    </div>
                    <div className="text-xs text-evon-muted mt-0.5 line-clamp-2">
                      {r.content}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
});

SearchBar.displayName = "SearchBar";

export default SearchBar;
