import type { Metadata } from "next";
import { Noto_Serif_SC, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cognitive Asset Lab — AI 工程实践 × 认知资产构建",
  description:
    "6 年 Java 后端转向 AI 工程实践。构建认知资产系统，探索 Agent、多智能体、Prompt 工程和 AI 产品开发。",
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
    description: "AI 工程实践 × 认知资产构建",
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
      className={`${notoSerifSC.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
