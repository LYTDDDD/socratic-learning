import type { Metadata } from "next";
import { Space_Grotesk, Noto_Sans_SC, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cognitive Asset Lab — AI 认知工作台",
  description:
    "面向离线任务分析、任务复盘、深度评分与认知资产候选的 AI 认知工作台。",
  keywords: [
    "AI Engineering",
    "Cognitive Asset",
    "Agent",
    "Multi-Agent",
    "Prompt Engineering",
    "LLM",
  ],
  openGraph: {
    title: "Cognitive Asset Lab",
    description: "离线任务分析与认知资产工作台",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${spaceGrotesk.variable} ${notoSansSC.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
