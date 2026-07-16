import type { Metadata } from "next";
import ErrorBoundary from "@/components/ErrorBoundary";
import I18nProvider from "@/i18n/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "E.V.O.N. — Enhanced Voice-Operated Nexus",
  description:
    "An offline AI assistant powered by Whisper, Ollama, and Piper TTS. Runs fully local.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-evon-bg text-evon-text overflow-hidden">
        {/* FEAT-013: Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBoundary>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
