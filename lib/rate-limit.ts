import type { NextRequest } from "next/server";
import prisma from "./prisma";

const MAX_ATTEMPTS_PER_HOUR = 2;

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export async function isIpBlacklisted(ip: string): Promise<boolean> {
  const entry = await prisma.ipBlacklist.findUnique({ where: { ip } });
  if (!entry) return false;
  if (entry.expiresAt && entry.expiresAt < new Date()) {
    await prisma.ipBlacklist.delete({ where: { ip } });
    return false;
  }
  return true;
}

export async function recordLoginAttempt(ip: string, email: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { ip, email, success } });
}

export async function checkAndEnforceRateLimit(ip: string): Promise<{ allowed: boolean; reason?: string }> {
  const blacklisted = await isIpBlacklisted(ip);
  if (blacklisted) {
    return { allowed: false, reason: "IP 已被拉黑" };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = await prisma.loginAttempt.count({
    where: { ip, createdAt: { gte: oneHourAgo } },
  });

  if (recentAttempts >= MAX_ATTEMPTS_PER_HOUR) {
    await prisma.ipBlacklist.create({
      data: {
        ip,
        reason: "rate_limit",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { allowed: false, reason: "请求次数超限，IP 已被拉黑 24 小时" };
  }

  return { allowed: true };
}

export async function cleanupOldAttempts(): Promise<void> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: oneWeekAgo } },
  });
}
