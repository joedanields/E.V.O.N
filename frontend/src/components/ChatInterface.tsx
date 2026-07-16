// ═══════════════════════════════════════════════════════════
//  ChatInterface — main chat area with input
// ═══════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Bot, Sparkles, Keyboard, Mic, ImagePlus, X } from "lucide-react";
import MessageBubble from "./MessageBubble";
import VoiceButton from "./VoiceButton";
import Waveform from "./Waveform";
import { useVoice } from "@/hooks/useVoice";
import { uploadImageForVision } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import type { InputMode, Message, VoicePipelineResult } from "@/types";

interface ChatInterfaceProps {
  messages: Message[];
  streamingContent: string;
  isLoading: boolean;
  activeConversationId: string | null;
  onSendMessage: (text: string, mode: InputMode, images?: string[]) => void;
  onAddVoiceMessages: (
    userMsg: Message,
    assistantMsg: Message,
    convId: string
  ) => void;
}

export default function ChatInterface({
  messages,
  streamingContent,
  isLoading,
  activeConversationId,
  onSendMessage,
  onAddVoiceMessages,
}: ChatInterfaceProps) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [attachedImages, setAttachedImages] = useState<string[]>([]); // base64 strings
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Voice hook ─────────────────────────────────────────
  const {
    isRecording,
    isProcessing,
    isSpeaking,
    toggleRecording,
    playTTS,
    getAnalyser,
  } = useVoice({
    conversationId: activeConversationId,
    onResult: (result: VoicePipelineResult) => {
      onAddVoiceMessages(
        result.user_message,
        result.assistant_message,
        result.conversation_id
      );
    },
    onError: (err) => console.error("Voice error:", err),
  });

// ── FEAT-011: Push-to-talk (hold Space to record) ─────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
      if (e.code === "Space" && !isInput && !isLoading && !isRecording && !isProcessing) {
        e.preventDefault();
        toggleRecording();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
      if (e.code === "Space" && !isInput && isRecording) {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isLoading, isRecording, isProcessing, toggleRecording]);

  // ── Auto-scroll ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // ── Focus input ───────────────────────────────────────
  useEffect(() => {
    if (inputMode === "text") {
      inputRef.current?.focus();
    }
  }, [inputMode]);

  // ── Send handler ──────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    const images = attachedImages.length > 0 ? [...attachedImages] : undefined;
    setAttachedImages([]);
    onSendMessage(text, "text", images);
  }, [input, isLoading, onSendMessage, attachedImages]);

  // ── Image upload handler ──────────────────────────────
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await uploadImageForVision(file);
      setAttachedImages((prev) => [...prev, result.image_base64]);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  // ── Keyboard handler ──────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Auto-resize textarea ──────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex-1 flex flex-col h-full bg-evon-bg">
      {/* ── Messages Area ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSpeak={playTTS}
              />
            ))}

            {/* Streaming response */}
            {streamingContent && (
              <div className="flex gap-3 animate-fade-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-evon-accent to-evon-accent-dim flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-evon-card border border-evon-border text-evon-text">
                  <p className="whitespace-pre-wrap">{streamingContent}</p>
                  <span className="inline-block w-2 h-4 bg-evon-accent animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex gap-3 animate-fade-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-evon-accent to-evon-accent-dim flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-evon-card border border-evon-border">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-evon-accent rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-evon-accent rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-evon-accent rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Waveform (visible in voice mode or when speaking) ── */}
      {(inputMode === "voice" || isRecording || isSpeaking) && (
        <div className="px-6 py-2">
          <Waveform
            isActive={isRecording || isSpeaking}
            analyser={getAnalyser()}
          />
        </div>
      )}

      {/* ── Input Area ────────────────────────────────── */}
      <div className="border-t border-evon-border p-4">
        <div className="max-w-4xl mx-auto">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setInputMode("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         transition-all duration-200 ${
                           inputMode === "text"
                             ? "bg-evon-accent/20 text-evon-accent border border-evon-accent/30"
                             : "text-evon-muted hover:text-evon-text hover:bg-evon-card"
                         }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setInputMode("voice")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         transition-all duration-200 ${
                           inputMode === "voice"
                             ? "bg-evon-accent/20 text-evon-accent border border-evon-accent/30"
                             : "text-evon-muted hover:text-evon-text hover:bg-evon-card"
                         }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Voice
            </button>
          </div>

          {/* Input Row */}
          {inputMode === "text" ? (
            <div className="flex items-end gap-3">
              {/* Image preview */}
              {attachedImages.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {attachedImages.map((_, i) => (
                    <div key={i} className="relative w-12 h-12 rounded-lg bg-evon-card border border-evon-border overflow-hidden">
                      <img
                        src={`data:image/png;base64,${attachedImages[i]}`}
                        alt={`Attached image ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                        aria-label={`Remove image ${i + 1}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1 relative">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="Upload image"
                />
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedImages.length > 0 ? "Ask about this image…" : "Message E.V.O.N. …"}
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none rounded-2xl bg-evon-card border border-evon-border
                             px-4 py-3 pr-20 text-sm text-evon-text placeholder:text-evon-muted
                             focus:outline-none focus:border-evon-accent/50 focus:shadow-[0_0_15px_rgba(168,85,247,0.1)]
                             transition-all duration-200 disabled:opacity-50 max-h-40"
                />
                {/* Image upload button inside textarea */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || isLoading}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-evon-muted
                             hover:text-evon-accent hover:bg-evon-accent/10 transition-colors disabled:opacity-30"
                  title="Attach image"
                  aria-label="Attach image for vision"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
                           bg-evon-accent text-white hover:bg-evon-accent-dim
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-all duration-200 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
              >
                <Send className="w-4 h-4" />
              </button>
              {/* Quick voice button in text mode */}
              <VoiceButton
                isRecording={isRecording}
                isProcessing={isProcessing}
                onClick={toggleRecording}
                size="sm"
              />
            </div>
          ) : (
            /* Voice mode — large center mic */
            <div className="flex flex-col items-center gap-4 py-4">
              <VoiceButton
                isRecording={isRecording}
                isProcessing={isProcessing}
                onClick={toggleRecording}
                size="lg"
              />
              <p className="text-sm text-evon-muted">
                {isRecording
                  ? t.chat_listening
                  : isProcessing
                  ? t.chat_processing
                  : t.chat_tap_to_speak}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────
function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        {/* Animated logo */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-evon-accent/30 to-evon-accent-dim/20 animate-pulse-glow" />
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-evon-accent to-evon-accent-dim flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {t.chat_empty_title}
          </h2>
          <p className="text-evon-muted text-sm leading-relaxed">
            {t.chat_empty_desc}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { icon: "💬", text: t.chat_empty_1 },
            { icon: "🖥️", text: t.chat_empty_2 },
            { icon: "🧑‍💻", text: t.chat_empty_3 },
            { icon: "🎤", text: t.chat_empty_4 },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-evon-card border border-evon-border text-sm text-evon-muted"
            >
              <span>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
