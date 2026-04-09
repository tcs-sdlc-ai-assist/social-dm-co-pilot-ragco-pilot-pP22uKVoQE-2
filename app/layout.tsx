import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Social DM Copilot — Stockland",
  description:
    "AI-powered direct message management platform for drafting, reviewing, and sending responses to social media DMs while automatically extracting and qualifying leads.",
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
    <html lang="en" className="scroll-smooth antialiased">
      <body className="bg-gray-50 text-gray-900 text-sm leading-relaxed font-sans">
        <AuthProvider>
          <Header />
          <main className="min-h-screen-nav">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}