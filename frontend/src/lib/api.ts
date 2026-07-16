// ═══════════════════════════════════════════════════════════
//  E.V.O.N. Frontend — API Client
// ═══════════════════════════════════════════════════════════

import type {
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationListItem,
  StreamEvent,
  TranscriptionResponse,
  SystemInfo,
  VoicePipelineResult,
} from "@/types";

// Use relative URLs so requests go through Next.js rewrites (proxy to backend)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ── MISS-004: Retry helper with exponential backoff ─────

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on client errors (4xx)
      if (lastError.message.includes("4") && !lastError.message.includes("502")) {
        throw lastError;
      }
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ── Helpers ──────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Chat ─────────────────────────────────────────────────

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  return retryWithBackoff(() =>
    apiFetch<ChatResponse>("/api/chat/", {
      method: "POST",
      body: JSON.stringify(req),
    })
  );
}

export async function* streamMessage(
  req: ChatRequest
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`Stream error: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const event: StreamEvent = JSON.parse(trimmed.slice(6));
          yield event;
        } catch {
          // skip malformed
        }
      }
    }
  }
}

// ── Conversations ────────────────────────────────────────

export async function getConversations(): Promise<ConversationListItem[]> {
  return retryWithBackoff(() =>
    apiFetch<ConversationListItem[]>("/api/chat/conversations")
  );
}

export async function getConversation(id: string): Promise<Conversation> {
  return retryWithBackoff(() =>
    apiFetch<Conversation>(`/api/chat/conversations/${id}`)
  );
}

export async function deleteConversation(id: string): Promise<void> {
  await retryWithBackoff(() =>
    apiFetch(`/api/chat/conversations/${id}`, { method: "DELETE" })
  );
}

export async function clearConversations(): Promise<void> {
  await retryWithBackoff(() =>
    apiFetch("/api/chat/conversations", { method: "DELETE" })
  );
}

// ── Voice ────────────────────────────────────────────────

export async function transcribeAudio(
  audioBlob: Blob
): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || "Transcription failed");
  }
  return res.json();
}

export async function voicePipeline(
  audioBlob: Blob,
  conversationId?: string | null
): Promise<VoicePipelineResult> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  if (conversationId) form.append("conversation_id", conversationId);
  const res = await fetch(`${API_BASE}/api/voice/pipeline`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || "Voice pipeline failed");
  }
  return res.json();
}

export async function textToSpeech(text: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/voice/tts?text=${encodeURIComponent(text)}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || "TTS failed");
  }
  return res.blob();
}

export async function* streamVoicePipeline(
  audioBlob: Blob,
  conversationId?: string | null
): AsyncGenerator<StreamEvent> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  if (conversationId) form.append("conversation_id", conversationId);

  const res = await fetch(`${API_BASE}/api/voice/pipeline/stream`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Stream voice pipeline failed");

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No body");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("data: ")) {
        try {
          yield JSON.parse(t.slice(6));
        } catch {
          /* skip */
        }
      }
    }
  }
}

// ── System ───────────────────────────────────────────────

export async function openApplication(appName: string): Promise<{ success: boolean; message: string }> {
  return retryWithBackoff(() =>
    apiFetch<{ success: boolean; message: string }>("/api/system/open", {
      method: "POST",
      body: JSON.stringify({ app_name: appName }),
    })
  );
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return retryWithBackoff(() =>
    apiFetch<SystemInfo>("/api/system/info")
  );
}

export async function getAvailableApps(): Promise<string[]> {
  const data = await retryWithBackoff(() =>
    apiFetch<{ apps: string[] }>("/api/system/apps")
  );
  return data.apps;
}

// ── Health ───────────────────────────────────────────────

export async function healthCheck(): Promise<{
  status: string;
  ollama: string;
  stt: string;
}> {
  return apiFetch("/api/health");
}

// ── FEAT-009: Feedback ────────────────────────────────────

export async function setMessageFeedback(
  messageId: string,
  feedback: "up" | "down" | "none"
): Promise<{ status: string; feedback: string | null }> {
  return apiFetch(`/api/chat/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

// ── MISS-010: Model Management ─────────────────────────────

export async function listModels(): Promise<{ models: string[]; current: string }> {
  return apiFetch("/api/chat/models");
}

export async function switchModel(model: string): Promise<{ status: string; model: string }> {
  return apiFetch("/api/chat/models/switch", {
    method: "POST",
    body: JSON.stringify({ model }),
  });
}

// ── FEAT-007: Personas ────────────────────────────────────

export interface Persona {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
}

export async function getPersonas(): Promise<Persona[]> {
  return retryWithBackoff(() => apiFetch<Persona[]>("/api/personas/"));
}

export async function createPersona(persona: Omit<Persona, "id"> & { id: string }): Promise<Persona> {
  return apiFetch("/api/personas/", {
    method: "POST",
    body: JSON.stringify(persona),
  });
}

export async function deletePersona(id: string): Promise<void> {
  await apiFetch(`/api/personas/${id}`, { method: "DELETE" });
}

// ── FEAT-004: Tools ───────────────────────────────────────

export interface ToolSchema {
  name: string;
  description: string;
  parameters: object;
}

export async function getTools(): Promise<ToolSchema[]> {
  const data = await apiFetch<{ tools: ToolSchema[] }>("/api/tools/");
  return data.tools;
}

// ── MISS-003: Search ──────────────────────────────────────

export interface SearchResult {
  conversation_id: string;
  conversation_title: string;
  message_id: string;
  role: string;
  content: string;
  created_at?: string;
}

export async function searchConversations(query: string): Promise<SearchResult[]> {
  return retryWithBackoff(() =>
    apiFetch<SearchResult[]>(`/api/chat/search?q=${encodeURIComponent(query)}`)
  );
}

// ── MISS-002: Export / Import ──────────────────────────────

export async function exportConversation(id: string): Promise<object> {
  return retryWithBackoff(() =>
    apiFetch(`/api/chat/conversations/${id}/export`)
  );
}

export async function importConversation(data: {
  title?: string;
  messages: { role: string; content: string; input_mode?: string }[];
}): Promise<{ conversation_id: string; message_count: number }> {
  return apiFetch("/api/chat/import", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── FEAT-005: Vision — image upload ───────────────────────

export async function uploadImageForVision(file: File): Promise<{ image_base64: string; content_type: string; size: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/files/image-base64", {
    method: "POST",
    body: formData,
  });
}
