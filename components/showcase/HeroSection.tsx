"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FlaskConical } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const container = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const nodes = [
  { cx: 60, cy: 40, r: 6 },
  { cx: 160, cy: 80, r: 8 },
  { cx: 100, cy: 160, r: 5 },
  { cx: 220, cy: 50, r: 7 },
  { cx: 200, cy: 170, r: 6 },
  { cx: 280, cy: 120, r: 5 },
  { cx: 140, cy: 230, r: 7 },
  { cx: 300, cy: 200, r: 6 },
];

const edges = [
  [0, 1],
  [1, 2],
  [1, 3],
  [3, 5],
  [2, 4],
  [4, 7],
  [5, 7],
  [2, 6],
  [4, 6],
];

function NetworkSvg() {
  return (
    <svg
      viewBox="0 0 360 280"
      fill="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      {edges.map(([from, to], i) => (
        <motion.line
          key={i}
          x1={nodes[from].cx}
          y1={nodes[from].cy}
          x2={nodes[to].cx}
          y2={nodes[to].cy}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          className="text-moss/40"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 + i * 0.05, ease: "easeOut" }}
        />
      ))}
      {nodes.map((node, i) => (
        <motion.circle
          key={i}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          className="text-moss"
          fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: [0, 1, 0.7] }}
          transition={{
            scale: { duration: 0.4, delay: 0.6 + i * 0.05, ease: "easeOut" },
            opacity: { duration: 0.6, delay: 0.6 + i * 0.05 },
          }}
        />
      ))}
      {nodes.map((node, i) => (
        <motion.circle
          key={`glow-${i}`}
          cx={node.cx}
          cy={node.cy}
          r={node.r + 4}
          className="text-moss"
          fill="currentColor"
          opacity={0}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{
            duration: 2.5,
            delay: 1.5 + i * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-24 md:pb-24 md:pt-32 lg:pt-40">
      <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
        <motion.div
          className="flex-1"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.p
            className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-rust"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            COGNITIVE ASSET LAB
          </motion.p>

          <motion.h1
            className="font-heading text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-ink md:text-[clamp(2.5rem,5vw,4rem)]"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            我在构建判断力，
          </motion.h1>
          <motion.h1
            className="font-heading text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-ink md:text-[clamp(2.5rem,5vw,4rem)]"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            不只是知识。
          </motion.h1>

          <motion.p
            className="mt-6 max-w-lg text-base leading-relaxed text-ink-muted md:text-lg"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            6 年 Java 后端 → AI 工程实践 | 认知资产系统 · Agent · Prompt
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.6, ease: "easeOut" }}
          >
            <Link
              href="/lab"
              className={buttonVariants({
                variant: "default",
                size: "lg",
                className: "gap-2 bg-moss text-white hover:bg-moss/90",
              })}
            >
              进入实验室
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/LYTDDDD/socratic-learning"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "gap-2 border-line text-ink hover:bg-paper-warm",
              })}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
          </motion.div>
        </motion.div>

        <div className="hidden h-[280px] w-[360px] flex-shrink-0 text-moss lg:block">
          <NetworkSvg />
        </div>
      </div>
    </section>
  );
}
