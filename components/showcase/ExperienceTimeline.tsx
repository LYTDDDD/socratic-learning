"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";

const milestones = [
  {
    year: "2019",
    title: "Java 后端开发",
    description: "分布式系统 · 微服务 · 中间件",
    current: false,
  },
  {
    year: "2022",
    title: "技术负责人",
    description: "团队管理 · 架构设计 · 技术选型",
    current: false,
  },
  {
    year: "2024",
    title: "AI 工程实践",
    description: "LLM 应用 · Prompt Engineering · Agent 开发",
    current: false,
  },
  {
    year: "2025",
    title: "认知资产系统",
    description: "多智能体 · 知识工程 · 认知科学",
    current: true,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function ExperienceTimeline() {
  return (
    <SectionWrapper>
      <span className="text-sm font-semibold uppercase tracking-wide text-rust">
        PATH
      </span>
      <h2 className="mt-2 font-heading text-3xl font-bold text-ink">
        从 Java 后端到 AI 工程
      </h2>

      <motion.div
        className="relative mt-10 ml-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-line" />

        {milestones.map((milestone) => (
          <motion.div
            key={milestone.year}
            variants={itemVariants}
            className="relative mb-8 pl-8 last:mb-0"
          >
            <div className="absolute left-0 top-1 -translate-x-1/2">
              {milestone.current ? (
                <motion.div
                  className="h-3 w-3 rounded-full bg-moss"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ) : (
                <div className="h-3 w-3 rounded-full bg-moss" />
              )}
            </div>

            <span className="text-xs font-medium uppercase tracking-wide text-rust">
              {milestone.year}
            </span>
            <h3 className="mt-1 font-heading text-lg font-semibold text-ink">
              {milestone.title}
            </h3>
            <p className="mt-1 text-sm text-ink/70">{milestone.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
