import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@socratic.dev";
  const password = "Socratic@2026";
  const name = "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`用户 ${email} 已存在，跳过`);
    return;
  }

  const hashedPassword = await hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: "admin" },
  });

  console.log(`默认管理员账号已创建:`);
  console.log(`  邮箱: ${user.email}`);
  console.log(`  密码: ${password}`);
  console.log(`  角色: ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
