"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";

const assets = [
  {
    title: "概念卡",
    description: "识别对话中的核心概念，从模糊感知到清晰定义",
    barColor: "bg-green-600",
    maturity: "Reference",
  },
  {
    title: "误区卡",
    description: "暴露隐藏假设和判断偏差，从错误中修正认知",
    barColor: "bg-red-500",
    maturity: "Understanding",
  },
  {
    title: "方法论卡",
    description: "提炼可迁移的方法和框架，从经验到能力",
    barColor: "bg-blue-600",
    maturity: "Ability",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function ThinkingAssetsSection() {
  return (
    <SectionWrapper>
      <span className="text-sm font-semibold uppercase tracking-wide text-rust">
        THINKING ASSETS
      </span>
      <h2 className="mt-2 font-heading text-3xl font-bold text-ink">
        不只是代码，是判断力的沉淀
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
        认知资产不是笔记，是经过分析、验证、可迁移的判断力单元。
      </p>

      <motion.div
        className="mt-10 grid gap-6 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        {assets.map((asset) => (
          <motion.div
            key={asset.title}
            variants={cardVariants}
            className="relative rounded-xl border border-line bg-surface-1 p-5 transition hover:bg-surface-2"
          >
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${asset.barColor}`}
            />
            <h3 className="font-heading text-lg font-semibold text-ink">
              {asset.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {asset.description}
            </p>
            <span className="mt-3 inline-block rounded bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink/60">
              {asset.maturity}
            </span>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-8">
        <Link
          href="/lab"
          className="text-sm font-medium text-moss transition hover:text-moss-light"
        >
          查看全部认知资产 →
        </Link>
      </div>
    </SectionWrapper>
  );
}
