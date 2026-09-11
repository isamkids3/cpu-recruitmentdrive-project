import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS Club Multimodal Booth Agent | Gemini 3.1 Flash Live",
  description: "Real-time multimodal AI recruitment booth co-host powered by Gemini 3.1 Flash Live Preview WebSocket API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
