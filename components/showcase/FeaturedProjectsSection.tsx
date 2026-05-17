"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { Badge } from "@/components/ui/badge";

const projects = [
  {
    title: "AI 学习实验室 + 认知资产系统",
    tags: ["Next.js", "TypeScript", "Agent"],
    description:
      "基于多 Agent 协作的认知资产分析系统。6 个专业 Agent 组成流水线，从对话复盘中提取概念卡、误区卡、方法论卡等认知资产，支持版本管理和间隔复习。",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimalist%20workspace%20with%20green%20desk%20lamp%20and%20notebooks%20on%20warm%20wooden%20desk%2C%20clean%20design&image_size=landscape_16_9",
  },
  {
    title: "Offline Mission Analysis Prompt",
    tags: ["Prompt Engineering", "LLM"],
    description:
      "精心设计的离线任务分析提示词，引导 AI 从对话中识别判断变化、隐藏假设和认知误区。从 v0.1 迭代到 v0.2，持续优化分析深度。",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20prompt%20engineering%20diagram%20with%20flowing%20text%20and%20arrows%2C%20dark%20green%20and%20warm%20orange&image_size=landscape_16_9",
  },
  {
    title: "Agent / 多智能体探索",
    tags: ["Multi-Agent", "AI Architecture"],
    description:
      "探索 Supervisor 模式的多 Agent 协作架构。每个 Agent 有独立职责和输出格式，通过编排器协调执行，支持 SSE 流式输出和超时控制。",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=network%20of%20connected%20nodes%20representing%20AI%20agents%20collaborating%2C%20green%20and%20orange%20color%20scheme&image_size=landscape_16_9",
  },
  {
    title: "Java 后端工程 → AI 工程迁移",
    tags: ["Java", "AI Engineering"],
    description:
      "将 6 年 Java 后端工程经验迁移到 AI 工程实践：系统设计思维用于 Agent 架构、测试驱动用于 Prompt 迭代、运维经验用于 LLM 部署。",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=bridge%20connecting%20traditional%20software%20engineering%20to%20AI%20engineering%2C%20warm%20colors&image_size=landscape_16_9",
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
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function FeaturedProjectsSection() {
  return (
    <SectionWrapper id="featured-projects">
      <p className="text-sm font-medium uppercase tracking-wide text-rust">
        REPRESENTATIVE PROJECTS
      </p>
      <h2 className="mt-2 font-heading text-3xl font-bold md:text-4xl">
        代表项目
      </h2>

      <motion.div
        className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        {projects.map((project) => (
          <motion.div
            key={project.title}
            variants={cardVariants}
            className="group rounded-xl border border-line bg-surface-1 overflow-hidden transition duration-300 hover:-translate-y-1"
          >
            <div className="overflow-hidden">
              <img
                src={project.image}
                alt={project.title}
                className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h3 className="card-title mt-3">{project.title}</h3>
              <p className="mt-2 text-sm text-ink-muted line-clamp-3">
                {project.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
