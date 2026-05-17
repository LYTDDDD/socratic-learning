"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

export function ContactSection() {
  return (
    <SectionWrapper>
      <div className="text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-rust">
          CONNECT
        </span>
        <h2 className="mt-2 font-heading text-3xl font-bold text-ink">
          保持连接
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-ink/70">
          如果你对 AI 工程、认知资产、Agent 架构有兴趣，欢迎交流。
        </p>

        <motion.div
          className="mt-8 flex items-center justify-center gap-4"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: "easeOut" as const }}
        >
          <a
            href="https://github.com/LYTDDDD/socratic-learning"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-dark"
          >
            <GithubIcon className="size-4" />
            GitHub
          </a>

          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-dark"
          >
            <FlaskConical className="size-4" />
            进入实验室
          </Link>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
