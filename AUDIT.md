# E.V.O.N. — Full Code Audit, Fixes & New Features

> **Date:** 2026-07-16
> **Scope:** Entire codebase — backend (FastAPI/Python) + frontend (Next.js/React/TypeScript)
> **Auditor:** AI Code Analyst

---

## Table of Contents

1. [Critical Security Fixes](#1-critical-security-fixes)
2. [Bug Fixes](#2-bug-fixes)
3. [Code Quality Improvements](#3-code-quality-improvements)
4. [Performance Optimizations](#4-performance-optimizations)
5. [Missing Features to Implement](#5-missing-features-to-implement)
6. [New Feature Suggestions](#6-new-feature-suggestions)
7. [Implementation Priority Matrix](#7-implementation-priority-matrix)

---

## 1. Critical Security Fixes

### SEC-001: Command Injection via `shell=True` in System Service
- **File:** `backend/app/services/system_service.py:146`
- **Severity:** CRITICAL
- **Issue:** `SAFE_COMMANDS` are executed via `subprocess.Popen(cmd, shell=True, ...)`. Even though the command dictionary is hardcoded, `shell=True` with string commands means the OS shell interprets the full string, which is inherently risky. If any command string is ever modified or extended carelessly, injection becomes possible.
- **Fix:** Use `subprocess.Popen(cmd.split(), shell=False)` or `shlex.split(cmd)` with `shell=False`. Refactor `SAFE_COMMANDS` to store argument lists instead of raw strings:
```python
SAFE_COMMANDS = {
    "shutdown": ["shutdown", "/s", "/t", "60"],
    "restart": ["shutdown", "/r", "/t", "60"],
    "cancel_shutdown": ["shutdown", "/a"],
    "lock": ["rundll32.exe", "user32.dll,LockWorkStation"],
    # ...
}
# Then: subprocess.Popen(cmd, shell=False, ...)
```

### SEC-002: No Authentication on Any Endpoint
- **File:** All routers
- **Severity:** HIGH
- **Issue:** Every API endpoint (including `/api/system/open`, `/api/system/command`) is completely open. Any device on the local network can open applications, execute system commands, or access chat history.
- **Fix:** Add API key or Bearer token authentication middleware:
```python
# backend/app/auth.py
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader
from app.config import settings

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != settings.API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

### SEC-003: `os.startfile()` Fallback with User Input
- **File:** `backend/app/services/system_service.py:126`
- **Severity:** HIGH
- **Issue:** If the app name isn't in the registry, `os.startfile(key)` is called with the raw user input. On Windows, `startfile` can execute arbitrary files by association. A user could send `"malicious.bat"` or `"http://evil.com"`.
- **Fix:** Remove or restrict the `os.startfile` fallback. Only allow known applications from the registry.

### SEC-004: CORS Too Permissive
- **File:** `backend/app/main.py:81-87`
- **Severity:** MEDIUM
- **Issue:** `allow_methods=["*"]` and `allow_headers=["*"]` allows any HTTP method and header. While origins are restricted, this is still overly broad.
- **Fix:** Restrict to only needed methods and headers:
```python
allow_methods=["GET", "POST", "DELETE"],
allow_headers=["Content-Type", "Authorization"],
```

### SEC-005: No Rate Limiting
- **File:** All routers
- **Severity:** MEDIUM
- **Issue:** No rate limiting on any endpoint. An attacker (or buggy client) could flood the server with requests, exhausting GPU/CPU resources.
- **Fix:** Add `slowapi` or similar rate limiting middleware.

### SEC-006: Health Endpoint Leaks Internal State
- **File:** `backend/app/main.py:109-117`
- **Severity:** LOW
- **Issue:** The health endpoint reveals internal model loading state, Ollama connection details. In a network-exposed deployment, this is information leakage.
- **Fix:** Return only a simple `{"status": "ok"}` for external consumers; keep detailed health behind auth.

---

## 2. Bug Fixes

### BUG-001: Database Session Used After Response in SSE Generators
- **File:** `backend/app/routers/chat.py:116-145` and `backend/app/routers/voice.py:205-241`
- **Severity:** HIGH
- **Issue:** In both `chat_stream` and `voice_pipeline_stream`, the `event_stream()`/`event_gen()` generator performs DB operations (`db.flush()`, `db.add()`) inside the generator function. However, the generator runs *after* the `StreamingResponse` is returned. By that time, FastAPI may have already closed or committed the session via `get_db()`, causing `InvalidRequestError` or `SessionError`.
- **Fix:** Use a dedicated DB session inside the generator, or persist messages before returning the StreamingResponse. Example:
```python
# Before streaming, persist the user message and create assistant placeholder
async with async_session() as inner_db:
    async with inner_db.begin():
        inner_db.add(user_msg)
        inner_db.add(asst_msg_placeholder)

# In the generator, only yield SSE events (no DB operations)
```

### BUG-002: Deprecated `asyncio.get_event_loop()` in STT Service
- **File:** `backend/app/services/stt_service.py:76`
- **Severity:** MEDIUM
- **Issue:** `asyncio.get_event_loop()` is deprecated since Python 3.10 and will raise a `DeprecationWarning` in 3.12+. Inside an async context, it should be `asyncio.get_running_loop()`.
- **Fix:**
```python
try:
    loop = asyncio.get_running_loop()
    self._load_model_sync()
except RuntimeError:
    self._load_model_sync()
```

### BUG-003: `import json` Inside Loop Body
- **File:** `backend/app/services/llm_service.py:125`
- **Severity:** LOW
- **Issue:** `import json` is inside the `for line in resp.aiter_lines()` loop. While Python caches imports, this is unconventional and causes unnecessary overhead per iteration.
- **Fix:** Move `import json` to the top of the file.

### BUG-004: `tts_service.py` Blocks Event Loop
- **File:** `backend/app/services/tts_service.py:127-128`
- **Severity:** MEDIUM
- **Issue:** `pyttsx3` uses `self._pyttsx3_engine.save_to_file()` and `runAndWait()` which are synchronous/blocking calls. Running them directly in an `async def` blocks the entire event loop, freezing all other requests during TTS generation.
- **Fix:** Wrap in `asyncio.to_thread()`:
```python
await asyncio.to_thread(self._pyttsx3_engine.save_to_file, text, tmp_path)
await asyncio.to_thread(self._pyttsx3_engine.runAndWait)
```
Same issue exists in `_synthesize_piper` with `subprocess.run` — should use `asyncio.create_subprocess_exec`.

### BUG-005: Missing Cleanup in `useVoice.ts` on Unmount
- **File:** `frontend/src/hooks/useVoice.ts`
- **Severity:** MEDIUM
- **Issue:** `audioContextRef`, `analyserRef`, `sourceRef` are never cleaned up when the component unmounts. If the user navigates away while recording, the AudioContext and MediaStream remain open, causing resource leaks.
- **Fix:** Add a cleanup effect:
```typescript
useEffect(() => {
  return () => {
    mediaRecorderRef.current?.stop();
    audioContextRef.current?.close();
  };
}, []);
```

### BUG-006: Optimistic User Message Not Updated with Real ID
- **File:** `frontend/src/hooks/useChat.ts:61-69, 92-102`
- **Severity:** LOW
- **Issue:** A temporary user message with `id: temp-${Date.now()}` is added optimistically. When the stream completes, the assistant message is added but the user message's ID is never updated to the real server-side ID. This means the user message has a fake ID that doesn't match the database.
- **Fix:** When the `meta` event arrives with the `conversation_id`, also update the user message's `id` and `conversation_id` from the server response, or remove the optimistic message and re-fetch the conversation.

### BUG-007: `voice.py` TTS Endpoint Accepts Text as Query Parameter
- **File:** `backend/app/routers/voice.py:139`
- **Severity:** LOW
- **Issue:** The `/api/voice/tts` endpoint accepts `text` as a query parameter, but the frontend `api.ts` sends it correctly via query string. However, long text will hit URL length limits (typically ~2048 chars). For longer assistant responses, this will fail silently.
- **Fix:** Change to accept text in the request body (POST JSON or form data).

### BUG-008: No Validation on `conversation_id` in Voice Pipeline
- **File:** `backend/app/routers/voice.py:55, 165`
- **Severity:** LOW
- **Issue:** `conversation_id` is passed as `str | None = None` directly in the function signature, bypassing Pydantic validation. If a malformed UUID is sent, `db.get()` returns None silently and a new conversation is created, which may confuse the user.
- **Fix:** Add UUID format validation or at minimum log when falling back to a new conversation.

---

## 3. Code Quality Improvements

### QUALITY-001: Extract Shared Helpers (DRY Violation)
- **Files:** `backend/app/routers/chat.py:213-243` and `backend/app/routers/voice.py:247-276`
- **Issue:** `_get_or_create_conversation()` and `_get_history()` are copy-pasted identically between `chat.py` and `voice.py`.
- **Fix:** Extract to a shared module `backend/app/routers/deps.py`:
```python
# backend/app/routers/deps.py
async def get_or_create_conversation(db, conversation_id): ...
async def get_history(db, conversation_id, limit=20, exclude_last=False): ...
```

### QUALITY-002: Singleton Pattern Anti-pattern
- **Files:** `stt_service.py`, `llm_service.py`, `tts_service.py`, `system_service.py`
- **Issue:** Custom `__new__` singleton pattern is non-standard and makes testing harder. Python has cleaner approaches.
- **Fix:** Use module-level instances (which you already do at the bottom of each file). Remove the `__new__` override and make the constructor idempotent instead:
```python
class LLMService:
    _client: httpx.AsyncClient | None = None

    async def initialize(self):
        if self._client is not None:
            return
        self._client = httpx.AsyncClient(...)

# At module level:
llm_service = LLMService()
```

### QUALITY-003: Inconsistent Error Response Format
- **Files:** Various routers
- **Issue:** Some endpoints return dicts (`{"success": bool, "message": str}`), others raise `HTTPException`, others return Pydantic models. This creates an inconsistent API contract.
- **Fix:** Define a standard error response model and use it everywhere:
```python
class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: str | None = None
```

### QUALITY-004: Hardcoded Magic Numbers
- **Files:** `chat.py:229`, `voice.py:260`, `useChat.ts:110`
- **Issue:** History limit of `20` messages is hardcoded. Title truncation at `100` chars is hardcoded.
- **Fix:** Move to `config.py` as settings: `HISTORY_LIMIT = 20`, `TITLE_MAX_LENGTH = 100`.

### QUALITY-005: Missing Type Safety on Service Singletons
- **Files:** All service files
- **Issue:** `_model: Optional[WhisperModel] = None` is a class variable, which means it's shared across all instances (though there should only be one). If the singleton pattern is removed, this becomes a bug.
- **Fix:** Make these instance variables initialized in `__init__` or `initialize()`.

### QUALITY-006: No `__init__.py` Module Exports
- **Files:** `backend/app/services/__init__.py`, `backend/app/routers/__init__.py`
- **Issue:** These files are empty. They should export the service instances for cleaner imports.
- **Fix:**
```python
# backend/app/services/__init__.py
from .llm_service import llm_service
from .stt_service import stt_service
from .tts_service import tts_service
from .system_service import system_service
```

### QUALITY-007: Frontend Type Assertions Missing
- **File:** `frontend/src/lib/api.ts:192-206`
- **Issue:** `openApplication`, `getSystemInfo`, `getAvailableApps` don't use generic type parameters consistently with `apiFetch<T>()`.
- **Fix:** Add proper generic types to all `apiFetch` calls.

### QUALITY-008: Missing Error Boundaries in React
- **File:** `frontend/src/app/layout.tsx`
- **Issue:** No React Error Boundary component. If any component crashes, the entire app goes white.
- **Fix:** Add an error boundary wrapper in `layout.tsx`.

---

## 4. Performance Optimizations

### PERF-001: Synchronous TTS Calls Block Event Loop
- **File:** `backend/app/services/tts_service.py`
- **Issue:** Both Piper subprocess and pyttsx3 calls are synchronous and block the async event loop. During TTS generation, ALL other requests are stalled.
- **Fix:** Use `asyncio.create_subprocess_exec` for Piper and `asyncio.to_thread` for pyttsx3:
```python
async def _synthesize_piper(self, text: str) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "piper", "--model", settings.PIPER_MODEL_PATH,
        "--config", settings.PIPER_CONFIG_PATH, "--output-raw",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=text.encode("utf-8"))
    ...
```

### PERF-002: No TTS Audio Caching
- **File:** `backend/app/services/tts_service.py`
- **Issue:** The same text synthesized multiple times regenerates audio every time. Common phrases like greetings waste CPU/GPU.
- **Fix:** Add an LRU cache keyed by text hash:
```python
import hashlib
from functools import lru_cache

# Or use a dict-based cache with max size
self._cache: dict[str, bytes] = {}
MAX_CACHE = 100

async def synthesize(self, text: str) -> bytes:
    key = hashlib.md5(text.encode()).hexdigest()
    if key in self._cache:
        return self._cache[key]
    wav = await self._synthesize_impl(text)
    if len(self._cache) >= MAX_CACHE:
        self._cache.pop(next(iter(self._cache)))
    self._cache[key] = wav
    return wav
```

### PERF-003: No Conversation Pagination
- **File:** `backend/app/routers/chat.py:151-173`
- **Issue:** `list_conversations` loads ALL conversations with no pagination. With hundreds of conversations, this query becomes slow.
- **Fix:** Add `offset` and `limit` query parameters:
```python
@router.get("/conversations", response_model=list[ConversationListItem])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
```

### PERF-004: Unbounded History Growth
- **File:** `backend/app/routers/chat.py:229`
- **Issue:** History limit is 20 messages, but messages themselves grow unbounded. A long conversation with 1000+ messages still fetches the last 20, which is fine, but the DB table grows indefinitely.
- **Fix:** Add a message limit per conversation and auto-prune old messages, or implement conversation archival.

### PERF-005: Frontend Health Check Interval
- **File:** `frontend/src/app/page.tsx:44`
- **Issue:** Health check polls every 30 seconds. While reasonable, it creates unnecessary traffic if the backend is stable.
- **Fix:** Implement exponential backoff — check every 30s when offline, every 5 minutes when online.

### PERF-006: Canvas Waveform Re-renders Entire Canvas Each Frame
- **File:** `frontend/src/components/Waveform.tsx`
- **Issue:** The waveform clears and redraws the entire canvas on every animation frame. For 32 bars this is fine, but it could be optimized by only redrawing changed bars.
- **Fix:** This is acceptable for the current bar count. No immediate change needed, but note for future scaling.

---

## 5. Missing Features to Implement

### MISS-001: File Upload Support (Partially Configured)
- **Status:** `UPLOAD_DIR` is configured in `config.py` but never used.
- **Fix:** Implement file upload endpoint for attachments, documents, images. This enables:
  - Uploading documents for the LLM to analyze
  - Sharing images (when vision models are supported)

### MISS-002: Conversation Export/Import
- **Status:** Not implemented.
- **Fix:** Add endpoints to export conversations as JSON/Markdown and import them back. Useful for backup and sharing.

### MISS-003: Conversation Search
- **Status:** Not implemented.
- **Fix:** Add full-text search across all conversations and messages using SQLite FTS5.

### MISS-004: Request Retry Logic (Frontend)
- **File:** `frontend/src/lib/api.ts`
- **Status:** No retry on failed requests. If the backend hiccups, the user gets an error immediately.
- **Fix:** Add exponential backoff retry wrapper around `apiFetch`.

### MISS-005: Loading States & Error Toasts (Frontend)
- **File:** `frontend/src/hooks/useChat.ts`
- **Status:** Errors are only logged to `console.error`. The user has no visual feedback when operations fail.
- **Fix:** Add a toast notification system (e.g., `sonner` or custom) and show errors to users.

### MISS-006: Abort/Cancel In-Flight Requests
- **File:** `frontend/src/hooks/useChat.ts:23`
- **Status:** `abortRef` is declared but never used. There's no way to cancel an in-progress LLM response.
- **Fix:** Wire up `AbortController` to the fetch requests so users can cancel long-running responses.

### MISS-007: Keyboard Shortcuts
- **Status:** Not implemented.
- **Fix:** Add global keyboard shortcuts:
  - `Ctrl+N` — New conversation
  - `Ctrl+Shift+V` — Toggle voice mode
  - `Escape` — Cancel streaming
  - `Ctrl+K` — Command palette

### MISS-008: Responsive Mobile Layout
- **File:** `frontend/src/app/page.tsx`
- **Status:** Sidebar has mobile overlay logic but the chat interface isn't optimized for small screens.
- **Fix:** Add mobile-specific layouts, swipe gestures for sidebar, and touch-optimized voice button.

### MISS-009: System Prompt Customization
- **File:** `backend/app/config.py:55-61`
- **Status:** System prompt is hardcoded. Users can't customize the AI's personality.
- **Fix:** Add a settings endpoint and UI to modify the system prompt per conversation.

### MISS-010: Model Switching from UI
- **Status:** The Ollama model is set via `.env` only. Users must restart the backend to change models.
- **Fix:** Add an endpoint to list available Ollama models and switch between them dynamically.

---

## 6. New Feature Suggestions

### FEAT-001: Streaming TTS Audio
- **Description:** Instead of waiting for the full TTS synthesis, stream audio chunks as they're generated. This dramatically reduces perceived latency.
- **Implementation:** Use Piper's `--output-raw` with chunked reading and WebSocket/SSE audio streaming to the frontend.

### FEAT-002: Conversation Branching (Edit & Regenerate)
- **Description:** Allow users to edit a previous message and regenerate all subsequent responses from that point. Creates a conversation "tree."
- **Implementation:** Store parent message IDs, support branching in the DB schema, add UI for edit/regenerate buttons.

### FEAT-003: Voice Wake Word Detection
- **Description:** Always-listening mode with a wake word like "Hey EVON" using a local wake word engine (e.g., Porcupine, openWakeWord).
- **Implementation:** Run a lightweight wake word detector in the background. When triggered, start full recording.

### FEAT-004: Plugin / Tool System
- **Description:** Allow the LLM to call external tools: calculator, web search (via local SearXNG), file operations, API calls.
- **Implementation:** Use Ollama's function calling or implement a ReAct-style tool loop:
```python
TOOLS = {
    "calculator": calculator_tool,
    "web_search": web_search_tool,
    "file_read": file_read_tool,
}
```

### FEAT-005: Multi-Modal Input (Vision)
- **Description:** Upload images for the LLM to analyze. Uses vision-capable models like LLaVA via Ollama.
- **Implementation:** Add image upload endpoint, encode images to base64, send to Ollama with vision models.

### FEAT-006: Real-Time Voice Chat (WebSocket)
- **Description:** Full duplex voice conversation over WebSocket. Speak and hear responses simultaneously, like a phone call.
- **Implementation:** WebSocket connection streams audio bidirectionally. Backend runs STT → LLM → TTS pipeline continuously.

### FEAT-007: Custom Personas
- **Description:** Pre-built and user-created AI personas (e.g., "Code Tutor", "Creative Writer", "DevOps Helper") with custom system prompts, voices, and behaviors.
- **Implementation:** Persona config files, UI selector, per-persona settings.

### FEAT-008: Dark/Light Theme Toggle
- **Description:** Currently dark-only. Add a light theme option.
- **Implementation:** Extend Tailwind config with light theme colors, add toggle in sidebar, persist preference in localStorage.

### FEAT-009: Response Quality Feedback
- **Description:** Thumbs up/down on assistant messages to track quality and optionally fine-tune.
- **Implementation:** Add `feedback` column to Message model, UI buttons, optional feedback analytics endpoint.

### FEAT-010: Conversation Summarization
- **Description:** Auto-summarize long conversations into a brief overview. Useful for context when conversations get very long.
- **Implementation:** After N messages, use the LLM to generate a summary and store it. Use the summary as compressed context.

### FEAT-011: Global Push-to-Talk Hotkey
- **Description:** System-wide hotkey (e.g., `Ctrl+Shift+Space`) to activate voice input from any application.
- **Implementation:** Use `keyboard` Python library or frontend `GlobalKeyboard` API for system-wide hotkey detection.

### FEAT-012: Multi-Language Support (i18n)
- **Description:** Support UI localization and multi-language voice input/output.
- **Implementation:** Add `next-intl` or similar i18n library. Add language selection in settings. Use Whisper's multi-language capability.

### FEAT-013: Accessibility Improvements
- **Description:** Screen reader support, ARIA labels, high contrast mode, keyboard-navigable interface.
- **Implementation:** Audit all components for ARIA attributes, add skip navigation links, ensure all interactive elements are keyboard-accessible.

### FEAT-014: Session Persistence & Restart Recovery
- **Description:** Remember the active conversation across page refreshes and backend restarts.
- **Implementation:** Store active conversation ID in `localStorage`, restore on page load.

### FEAT-015: Admin Dashboard
- **Description:** Monitoring dashboard showing: active conversations, LLM usage stats, system resource utilization, error logs.
- **Implementation:** New `/admin` route with charts (using `recharts` or similar), backend metrics endpoint.

---

## 7. Implementation Priority Matrix

| Priority | ID | Title | Effort | Impact |
|----------|-----|-------|--------|--------|
| **P0** | SEC-001 | Fix `shell=True` command injection | Small | Critical |
| **P0** | SEC-002 | Add API authentication | Medium | Critical |
| **P0** | SEC-003 | Remove `os.startfile` fallback | Small | High |
| **P0** | BUG-001 | Fix DB session in SSE generators | Medium | High |
| **P1** | SEC-004 | Tighten CORS settings | Small | Medium |
| **P1** | SEC-005 | Add rate limiting | Medium | Medium |
| **P1** | BUG-004 | Fix blocking TTS calls | Medium | High |
| **P1** | BUG-005 | Fix memory leak in useVoice | Small | Medium |
| **P1** | PERF-001 | Async TTS subprocess | Medium | High |
| **P1** | MISS-006 | Wire up AbortController | Small | Medium |
| **P1** | MISS-005 | Add error toast notifications | Small | Medium |
| **P2** | BUG-002 | Fix deprecated asyncio call | Small | Low |
| **P2** | BUG-003 | Move import to top of file | Trivial | Low |
| **P2** | BUG-006 | Fix optimistic message IDs | Small | Low |
| **P2** | BUG-007 | TTS endpoint text in body | Small | Low |
| **P2** | QUALITY-001 | Extract shared helpers | Small | Medium |
| **P2** | QUALITY-003 | Standardize error format | Small | Medium |
| **P2** | QUALITY-008 | Add React Error Boundary | Small | Medium |
| **P2** | PERF-002 | Add TTS audio caching | Small | Medium |
| **P2** | PERF-003 | Add conversation pagination | Small | Medium |
| **P2** | MISS-001 | Implement file upload | Medium | Medium |
| **P2** | MISS-009 | System prompt customization | Small | Medium |
| **P2** | MISS-010 | Model switching from UI | Medium | Medium |
| **P3** | QUALITY-002 | Refactor singleton pattern | Medium | Low |
| **P3** | QUALITY-004 | Extract magic numbers | Small | Low |
| **P3** | MISS-002 | Conversation export/import | Medium | Low |
| **P3** | MISS-003 | Conversation search | Medium | Low |
| **P3** | MISS-007 | Keyboard shortcuts | Small | Low |
| **P3** | MISS-008 | Mobile layout optimization | Medium | Low |
| **P3** | FEAT-004 | Plugin/tool system | Large | High |
| **P3** | FEAT-002 | Conversation branching | Large | High |
| **P3** | FEAT-001 | Streaming TTS audio | Large | High |
| **P3** | FEAT-006 | Real-time voice chat | Large | High |
| **P3** | FEAT-003 | Voice wake word | Large | Medium |
| **P3** | FEAT-005 | Multi-modal vision | Large | Medium |
| **P3** | FEAT-007 | Custom personas | Medium | Medium |
| **P3** | FEAT-008 | Dark/light theme | Medium | Low |
| **P3** | FEAT-009 | Response feedback | Small | Low |
| **P3** | FEAT-010 | Conversation summarization | Medium | Medium |
| **P3** | FEAT-011 | Push-to-talk hotkey | Medium | Medium |
| **P3** | FEAT-012 | Multi-language i18n | Large | Medium |
| **P3** | FEAT-013 | Accessibility | Medium | Medium |
| **P3** | FEAT-014 | Session persistence | Small | Low |
| **P3** | FEAT-015 | Admin dashboard | Large | Medium |

---

## Summary

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Security | 6 | 3 | 1 | 2 | 0 |
| Bugs | 8 | 0 | 2 | 3 | 3 |
| Code Quality | 8 | 0 | 0 | 3 | 5 |
| Performance | 6 | 0 | 2 | 2 | 2 |
| Missing Features | 10 | 0 | 0 | 5 | 5 |
| New Features | 15 | 0 | 0 | 8 | 7 |
| **Total** | **53** | **3** | **5** | **23** | **22** |

**Recommended immediate actions:** Fix SEC-001, SEC-002, SEC-003, BUG-001, and BUG-004 before any public deployment.
