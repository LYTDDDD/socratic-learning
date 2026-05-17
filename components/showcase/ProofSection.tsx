"use client";

import Link from "next/link";
import { Code, FileText, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";

const proofs = [
  {
    icon: Code,
    title: "开源代码",
    description: "完整项目代码在 GitHub，包含 35+ 测试文件、500+ 测试用例",
  },
  {
    icon: FileText,
    title: "产品文档",
    description: "从产品定位到技术架构，每个决策都有文档记录",
  },
  {
    icon: FlaskConical,
    title: "可运行 Demo",
    description: "在线体验多 Agent 分析流水线和苏格拉底式对话",
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

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function ProofSection() {
  return (
    <SectionWrapper>
      <span className="text-sm font-semibold uppercase tracking-wide text-rust">
        PROOF
      </span>
      <h2 className="mt-2 font-heading text-3xl font-bold text-ink">
        可验证的工程实践
      </h2>

      <motion.div
        className="mt-10 grid gap-6 md:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        {proofs.map((proof) => (
          <motion.div
            key={proof.title}
            variants={itemVariants}
            className="rounded-xl border border-line bg-surface-1 p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <proof.icon className="h-6 w-6 text-moss" />
            <h3 className="mt-4 font-heading text-lg font-semibold text-ink">
              {proof.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              {proof.description}
            </p>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-8">
        <Link
          href="/lab"
          className="inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-2.5 text-sm font-medium text-white transition hover:bg-moss-dark"
        >
          进入实验室体验 →
        </Link>
      </div>
    </SectionWrapper>
  );
}
