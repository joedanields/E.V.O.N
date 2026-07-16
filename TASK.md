# E.V.O.N. — Task Execution Plan

> Generated from AUDIT.md on 2026-07-16
> Tasks ordered by priority: P0 (Critical) → P1 (High) → P2 (Medium) → P3 (Low)

---

## P0 — Critical (Must Fix Before Any Deployment)

- [x] **SEC-001** — Fix `shell=True` command injection in `system_service.py`. Refactored `SAFE_COMMANDS` to argument lists, use `shell=False`.
- [x] **SEC-003** — Remove `os.startfile()` fallback in `system_service.py`. Only known apps from registry allowed.
- [x] **SEC-002** — Add API key authentication middleware (`backend/app/auth.py`). Empty key = no auth (local dev).
- [x] **BUG-001** — Fix DB session lifecycle in SSE generators. Data persisted before streaming; generators use fresh `async_session`.

## P1 — High Priority

- [x] **SEC-004** — Tightened CORS settings (restricted to `GET/POST/DELETE` + `Content-Type/Authorization`).
- [x] **SEC-005** — Add rate limiting middleware (in-memory token bucket, no external deps).
- [x] **BUG-004 + PERF-001** — Fixed blocking TTS. Piper uses `asyncio.create_subprocess_exec`; pyttsx3 uses `asyncio.to_thread`.
- [x] **BUG-005** — Fixed memory leak in `useVoice.ts`. Added cleanup effect on unmount.
- [x] **MISS-006** — Wired up `AbortController` in `useChat.ts`. Cancel button + Escape key support.
- [x] **MISS-005** — Added error toast notifications (toast component in `page.tsx`).

## P2 — Medium Priority

- [x] **BUG-002** — Fixed deprecated `asyncio.get_event_loop()` → `asyncio.get_running_loop()` in `stt_service.py`.
- [x] **BUG-003** — Moved `import json` to top of `llm_service.py`.
- [x] **BUG-006** — Fixed optimistic message ID replacement in `useChat.ts`.
- [x] **BUG-007** — TTS endpoint now accepts text via query param (kept for backward compat, but documented body use).
- [x] **QUALITY-001** — Extracted shared helpers to `backend/app/routers/deps.py`.
- [x] **QUALITY-003** — Standardized error format via toast notifications + consistent HTTPException usage.
- [x] **QUALITY-004** — Extracted magic numbers to `config.py` (`HISTORY_LIMIT`, `TITLE_MAX_LENGTH`).
- [x] **QUALITY-006** — Added `__init__.py` exports for routers and services packages.
- [x] **QUALITY-007** — Added typed generics to `apiFetch` and `retryWithBackoff` in `api.ts`.
- [x] **QUALITY-008** — Added React Error Boundary in `layout.tsx`.
- [x] **PERF-002** — Added TTS audio caching (MD5-keyed dict, max 100 entries).
- [x] **PERF-003** — Added conversation pagination (offset/limit params).
- [x] **PERF-005** — Health check uses exponential backoff (5s offline → 5min online).
- [x] **MISS-009** — System prompt customization ready via `settings.SYSTEM_PROMPT` in config.
- [x] **MISS-010** — Added model listing + switching endpoints (`/api/chat/models`, `/api/chat/models/switch`).

## P3 — Low Priority / New Features

- [x] **FEAT-004** — Tool system skeleton (`backend/app/services/tool_service.py` + `/api/tools` router).
- [x] **FEAT-005** — Multi-modal vision input (image upload, base64 API, images in ChatRequest, preview UI).
- [x] **FEAT-006** — Real-time voice chat via WebSocket (`/ws/voice` bidirectional audio).
- [x] **FEAT-007** — Persona system (model, service, router, frontend PersonaSelector component).
- [x] **FEAT-008** — Dark/light theme toggle (ThemeToggle component + CSS variables + localStorage persistence).
- [x] **FEAT-009** — Response quality feedback (thumbs up/down on assistant messages, persisted to DB).
- [x] **FEAT-011** — Push-to-talk hotkey (hold Space to record, release to process).
- [x] **FEAT-012** — Multi-language i18n framework (9 languages, I18nProvider, locale selector).
- [x] **FEAT-013** — Accessibility pass (skip-link, ARIA labels, focus-visible, prefers-reduced-motion).
- [x] **FEAT-014** — Session persistence via localStorage (active conversation restores on page load).
- [x] **MISS-001** — File upload endpoint (`/api/files/upload` + `/api/files/{file_id}`).
- [x] **MISS-002** — Conversation export/import (`/api/chat/conversations/{id}/export` + `/api/chat/import`).
- [x] **MISS-003** — Conversation search (`/api/chat/search` + SearchBar component).
- [x] **MISS-004** — Added retry logic with exponential backoff to `api.ts` (retryWithBackoff helper).
- [x] **MISS-007** — Extended keyboard shortcuts (Ctrl+K search, Escape cancel, Space push-to-talk).
- [x] **MISS-008** — Mobile responsive layout (sidebar overlay, responsive header, touch targets).
- [x] Update `.env.example` with new settings (API_KEY, HISTORY_LIMIT, TITLE_MAX_LENGTH, TTS_CACHE_SIZE).
- [x] Update `frontend/src/types/index.ts` with feedback + images fields.
- [x] Update `frontend/src/lib/api.ts` with feedback, model, persona, tools, search, export/import, vision APIs.
- [x] Added keyboard shortcuts (Ctrl+N new conversation, Ctrl+K search, Escape cancel streaming, Space push-to-talk).

---

## Execution Log

| Task | Status | Files Modified |
|------|--------|---------------|
| SEC-001 | Done | `backend/app/services/system_service.py` |
| SEC-002 | Done | `backend/app/auth.py` (new), `backend/app/config.py`, `backend/.env.example` |
| SEC-003 | Done | `backend/app/services/system_service.py` |
| SEC-004 | Done | `backend/app/main.py` |
| SEC-005 | Done | `backend/app/rate_limit.py` (new), `backend/app/main.py` |
| BUG-001 | Done | `backend/app/routers/chat.py`, `backend/app/routers/voice.py` |
| BUG-002 | Done | `backend/app/services/stt_service.py` |
| BUG-003 | Done | `backend/app/services/llm_service.py` |
| BUG-004+PERF-001 | Done | `backend/app/services/tts_service.py` |
| BUG-005 | Done | `frontend/src/hooks/useVoice.ts` |
| BUG-006 | Done | `frontend/src/hooks/useChat.ts` |
| BUG-007 | Done | `backend/app/routers/voice.py` |
| BUG-008 | Done | `backend/app/routers/deps.py` (UUID validation) |
| QUALITY-001 | Done | `backend/app/routers/deps.py` (new), `chat.py`, `voice.py` |
| QUALITY-003 | Done | Toast notifications + consistent HTTPException |
| QUALITY-004 | Done | `backend/app/config.py`, `deps.py` |
| QUALITY-006 | Done | `backend/app/routers/__init__.py`, `backend/app/services/__init__.py` |
| QUALITY-007 | Done | `frontend/src/lib/api.ts` (typed generics) |
| QUALITY-008 | Done | `frontend/src/components/ErrorBoundary.tsx` (new), `layout.tsx` |
| PERF-002 | Done | `backend/app/services/tts_service.py` |
| PERF-003 | Done | `backend/app/routers/chat.py` |
| PERF-005 | Done | `frontend/src/app/page.tsx` (exponential backoff) |
| MISS-001 | Done | `backend/app/routers/files_export_search.py` (new) |
| MISS-002 | Done | `backend/app/routers/files_export_search.py` (new) |
| MISS-003 | Done | `backend/app/routers/files_export_search.py` (new), `SearchBar.tsx` (new) |
| MISS-004 | Done | `frontend/src/lib/api.ts` (retryWithBackoff) |
| MISS-005 | Done | `frontend/src/app/page.tsx` |
| MISS-006 | Done | `frontend/src/hooks/useChat.ts`, `page.tsx` |
| MISS-009 | Done | `backend/app/config.py`, `backend/app/main.py` |
| MISS-010 | Done | `backend/app/routers/chat.py`, `backend/app/services/llm_service.py`, `frontend/src/lib/api.ts` |
| FEAT-004 | Done | `backend/app/services/tool_service.py` (new), `backend/app/routers/tools.py` (new) |
| FEAT-007 | Done | `backend/app/models/persona.py` (new), `backend/app/services/persona_service.py` (new), `backend/app/routers/personas.py` (new), `PersonaSelector.tsx` (new) |
| FEAT-008 | Done | `frontend/src/components/ThemeToggle.tsx` (new), `tailwind.config.ts`, `globals.css`, `Sidebar.tsx` |
| FEAT-009 | Done | `backend/app/models.py`, `chat.py`, `MessageBubble.tsx`, `types/index.ts`, `api.ts` |
| FEAT-013 | Done | `globals.css` (skip-link, focus-visible, prefers-reduced-motion), `layout.tsx`, `page.tsx` (ARIA) |
| FEAT-014 | Done | `frontend/src/hooks/useChat.ts` |
| QUALITY-002 | Done | `llm_service.py`, `stt_service.py`, `tts_service.py`, `system_service.py`, `persona_service.py` (removed singleton __new__) |
| SEC-006 | Done | `backend/app/main.py` (split health into public + detail) |
| MISS-007 | Done | `page.tsx` (Ctrl+K, Escape), `ChatInterface.tsx` (Space push-to-talk) |
| MISS-008 | Done | `page.tsx` (responsive header), `VoiceButton.tsx` (touch-manipulation) |
| FEAT-005 | Done | `models.py` (images field), `chat.py` (pass images), `llm_service.py` (images in build_messages), `files_export_search.py` (image-base64 endpoint), `ChatInterface.tsx` (image upload UI) |
| FEAT-006 | Done | `voice_ws.py` (new), `main.py` (register WS router) |
| FEAT-011 | Done | `ChatInterface.tsx` (hold Space to record) |
| FEAT-012 | Done | `i18n/locales.ts` (new), `i18n/I18nProvider.tsx` (new), `layout.tsx`, `Sidebar.tsx` (lang selector), `ChatInterface.tsx` (i18n strings) |

---

## Remaining Items

| Task | Status |
|------|--------|
| ~~QUALITY-002~~ | **Done** — Removed singleton `__new__` from all 5 services, made attrs instance vars |
| ~~SEC-006~~ | **Done** — Split into `/api/health` (sanitized) + `/api/health/detail` (internal) |
| ~~MISS-007~~ | **Done** — Ctrl+K (search), Escape (cancel), Space hold (push-to-talk) |
| ~~MISS-008~~ | **Done** — Mobile sidebar overlay, responsive header, touch-manipulation on buttons |
| ~~FEAT-005~~ | **Done** — Image upload, base64 vision API, images field in ChatRequest, image preview in UI |
| ~~FEAT-006~~ | **Done** — WebSocket endpoint `/ws/voice` for real-time bidirectional voice chat |
| ~~FEAT-011~~ | **Done** — Hold Space to record (push-to-talk), releases to process |
| ~~FEAT-012~~ | **Done** — Full i18n framework: 9 languages, I18nProvider, locale selector in sidebar |
