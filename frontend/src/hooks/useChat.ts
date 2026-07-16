// ═══════════════════════════════════════════════════════════
//  useChat — manages conversation state & streaming
// ═══════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationListItem, Message, StreamEvent } from "@/types";
import {
  getConversation,
  getConversations,
  streamMessage,
  deleteConversation as apiDeleteConversation,
  clearConversations as apiClearConversations,
} from "@/lib/api";

// FEAT-014: localStorage persistence helpers
const STORAGE_KEY = "evon_active_conversation";

function loadPersistedConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistConversationId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable
  }
}

export interface UseChatOptions {
  onError?: (error: string) => void;
}

export function useChat({ onError }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  // FEAT-014: Restore from localStorage
  const [activeConversationId, setActiveConversationId] = useState<string | null>(loadPersistedConversationId);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  // MISS-006: AbortController for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // FEAT-014: Persist conversation ID changes
  useEffect(() => {
    persistConversationId(activeConversationId);
  }, [activeConversationId]);

  // FEAT-014: Auto-load persisted conversation on mount
  useEffect(() => {
    const savedId = loadPersistedConversationId();
    if (savedId) {
      loadConversation(savedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load conversations list ────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const convs = await getConversations();
      setConversations(convs);
    } catch (err) {
      console.error("Failed to load conversations:", err);
      onError?.("Failed to load conversations");
    }
  }, [onError]);

  // ── Load a specific conversation ──────────────────────
  const loadConversation = useCallback(async (id: string) => {
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages);
      setActiveConversationId(id);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      onError?.("Failed to load conversation");
    }
  }, [onError]);

  // ── Start a new conversation ──────────────────────────
  const newConversation = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setStreamingContent("");
  }, []);

  // ── Cancel streaming ─────────────────────────────────
  const cancelStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setStreamingContent("");
  }, []);

  // ── Send message with streaming ───────────────────────
  const sendMessage = useCallback(
    async (text: string, inputMode: "text" | "voice" = "text", images?: string[]) => {
      if (!text.trim() || isLoading) return;
      setIsLoading(true);
      setStreamingContent("");

      // BUG-006 FIX: Use a stable temp ID that we track for replacement
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempUserMsg: Message = {
        id: tempId,
        conversation_id: activeConversationId || "",
        role: "user",
        content: text,
        input_mode: inputMode,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // MISS-006: Create AbortController
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let convId = activeConversationId;
        let fullResponse = "";
        let realUserId: string | null = null;

        for await (const event of streamMessage({
          conversation_id: activeConversationId,
          message: text,
          input_mode: inputMode,
          images: images,
        })) {
          // Check if aborted
          if (controller.signal.aborted) break;

          switch (event.type) {
            case "meta":
              if (event.conversation_id) {
                convId = event.conversation_id;
                setActiveConversationId(convId);
              }
              // BUG-006: The meta event could include the real user message ID
              if (event.message_id) {
                realUserId = event.message_id;
              }
              break;
            case "token":
              fullResponse += event.content || "";
              setStreamingContent(fullResponse);
              break;
            case "done":
              // BUG-006: Replace temp message with real data
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId
                    ? { ...m, id: realUserId || m.id, conversation_id: convId || m.conversation_id }
                    : m
                )
              );
              const assistantMsg: Message = {
                id: `asst-${Date.now()}`,
                conversation_id: convId || "",
                role: "assistant",
                content: event.content || fullResponse,
                input_mode: "text",
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingContent("");
              break;
            case "error":
              console.error("Stream error:", event.content);
              onError?.(event.content || "Stream error occurred");
              break;
          }
        }

        await loadConversations();
      } catch (err) {
        if (controller.signal.aborted) {
          console.log("Stream cancelled by user");
        } else {
          console.error("Send message failed:", err);
          onError?.("Failed to send message. Is the backend running?");
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
      } finally {
        setIsLoading(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [activeConversationId, isLoading, loadConversations, onError]
  );

  // ── Add messages from voice pipeline ──────────────────
  const addVoiceMessages = useCallback(
    (userMsg: Message, assistantMsg: Message, convId: string) => {
      setActiveConversationId(convId);
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      loadConversations();
    },
    [loadConversations]
  );

  // ── Delete conversation ───────────────────────────────
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiDeleteConversation(id);
        if (activeConversationId === id) {
          newConversation();
        }
        await loadConversations();
      } catch (err) {
        console.error("Delete failed:", err);
        onError?.("Failed to delete conversation");
      }
    },
    [activeConversationId, loadConversations, newConversation, onError]
  );

  // ── Clear all conversations ───────────────────────────
  const clearAll = useCallback(async () => {
    try {
      await apiClearConversations();
      newConversation();
      setConversations([]);
    } catch (err) {
      console.error("Clear failed:", err);
      onError?.("Failed to clear conversations");
    }
  }, [newConversation, onError]);

  return {
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
  };
}
