// ═══════════════════════════════════════════════════════════
//  E.V.O.N. — Main Page
// ═══════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";
import SearchBar, { type SearchBarHandle } from "@/components/SearchBar";
import { useChat } from "@/hooks/useChat";
import { healthCheck } from "@/lib/api";
import { Menu, X, Wifi, WifiOff, AlertCircle } from "lucide-react";

export default function Home() {
  const [toastError, setToastError] = useState<string | null>(null);

  const onError = useCallback((msg: string) => {
    setToastError(msg);
    setTimeout(() => setToastError(null), 5000);
  }, []);

  const {
    messages,
    conversations,
    activeConversationId,
    isLoading,
    streamingContent,
    sendMessage,
    loadConversations,
    loadConversation,
    newConversation,
    deleteConversation,
    clearAll,
    addVoiceMessages,
    cancelStreaming,
  } = useChat({ onError });

  const searchRef = useRef<SearchBarHandle>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  // ── Check backend health with exponential backoff ─────
  useEffect(() => {
    let intervalMs = 30000; // Start at 30s when online
    let timeoutId: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        await healthCheck();
        setBackendStatus("online");
        intervalMs = 300000; // 5 minutes when online
      } catch {
        setBackendStatus("offline");
        intervalMs = 5000; // 5s when offline (retry faster)
      }
      timeoutId = setTimeout(check, intervalMs);
    };

    check();
    return () => clearTimeout(timeoutId);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ctrl+K — Focus search bar
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // Ctrl+N — New conversation
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        newConversation();
      }
      // Ctrl+Shift+V — Toggle voice mode (handled by VoiceButton internally)
      // Escape — Cancel streaming
      if (e.key === "Escape" && isLoading) {
        cancelStreaming();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [newConversation, cancelStreaming, isLoading, searchRef]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Error Toast ───────────────────────────────── */}
      {toastError && (
        <div className="fixed top-4 right-4 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm max-w-sm">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-300">{toastError}</span>
            <button onClick={() => setToastError(null)} className="ml-2 text-red-400/60 hover:text-red-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile sidebar overlay ─────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────── */}
      <div
        className={`fixed lg:relative z-40 h-full transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={(id) => {
            loadConversation(id);
            setSidebarOpen(false);
          }}
          onNew={() => {
            newConversation();
            setSidebarOpen(false);
          }}
          onDelete={deleteConversation}
          onClearAll={clearAll}
          onLoadConversations={loadConversations}
        />
      </div>

      {/* ── Main area ──────────────────────────────────── */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0" role="main" aria-label="Chat interface">
        {/* Top bar */}
        <header className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-evon-border bg-evon-surface/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-evon-card text-evon-muted transition-colors flex-shrink-0"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="text-sm font-medium text-evon-text truncate">
              {activeConversationId
                ? conversations.find((c) => c.id === activeConversationId)?.title || "Conversation"
                : "New Conversation"}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <SearchBar ref={searchRef} onSelectConversation={loadConversation} />


            {/* Cancel button — visible during streaming */}
            {isLoading && (
              <button
                onClick={cancelStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <X className="w-3 h-3" />
                Stop
              </button>
            )}

            {/* Backend status indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                backendStatus === "online"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : backendStatus === "offline"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              }`}
            >
              {backendStatus === "online" ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {backendStatus === "checking"
                ? "Checking…"
                : backendStatus === "online"
                ? "Backend Online"
                : "Backend Offline"}
            </div>
          </div>
        </header>

        {/* Chat interface */}
        <ChatInterface
          messages={messages}
          streamingContent={streamingContent}
          isLoading={isLoading}
          activeConversationId={activeConversationId}
          onSendMessage={sendMessage}
          onAddVoiceMessages={addVoiceMessages}
        />
      </div>
    </div>
  );
}
