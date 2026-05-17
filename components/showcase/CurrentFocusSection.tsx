"use client";

import { Brain, Workflow, MessageCircle } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";

const focusItems = [
  {
    icon: Brain,
    title: "认知资产系统",
    description:
      "5 种资产卡片类型，成熟度从 Reference → Understanding → Ability，版本管理和复习机制",
  },
  {
    icon: Workflow,
    title: "多 Agent 分析流水线",
    description:
      "6 个专业 Agent 协作：Supervisor → Review → Depth → Asset → Curator → Reflection",
  },
  {
    icon: MessageCircle,
    title: "苏格拉底式对话",
    description:
      "实时对话引导深度思考，支持偏好规则注入和纠正反馈",
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export function CurrentFocusSection() {
  return (
    <SectionWrapper>
      <span className="text-sm font-semibold uppercase tracking-wide text-rust">
        CURRENT FOCUS
      </span>
      <h2 className="mt-2 font-heading text-3xl font-bold text-ink">
        当前方向
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
        正在构建 AI 学习实验室 + 认知资产系统——一个帮助人们修正判断力、沉淀认知资产的工具。
      </p>

      <motion.div
        className="mt-10 grid gap-6 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        {focusItems.map((item) => (
          <motion.div
            key={item.title}
            variants={itemVariants}
            className="rounded-xl border border-line bg-surface-1 p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <item.icon className="h-6 w-6 text-moss" />
            <h3 className="mt-4 font-heading text-lg font-semibold text-ink">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {item.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
