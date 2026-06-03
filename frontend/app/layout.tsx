import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast/ToastProvider";

export const metadata: Metadata = {
  title: "Video Timeline Editor",
  description: "AI-powered video timeline editing through natural language",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
