import { describe, it, expect, vi, beforeEach } from "vitest";
import { hash, compare } from "bcryptjs";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    ipBlacklist: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
    loginAttempt: { count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock("../lib/prisma", () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { checkAndEnforceRateLimit, recordLoginAttempt } from "../lib/rate-limit";

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when IP is not blacklisted and under limit", async () => {
    mockPrisma.ipBlacklist.findUnique.mockResolvedValue(null);
    mockPrisma.loginAttempt.count.mockResolvedValue(0);

    const result = await checkAndEnforceRateLimit("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks request when IP is blacklisted", async () => {
    mockPrisma.ipBlacklist.findUnique.mockResolvedValue({
      ip: "192.168.1.1",
      reason: "rate_limit",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await checkAndEnforceRateLimit("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("拉黑");
  });

  it("removes expired blacklist entry and allows request", async () => {
    mockPrisma.ipBlacklist.findUnique.mockResolvedValue({
      ip: "192.168.1.1",
      reason: "rate_limit",
      expiresAt: new Date(Date.now() - 1000),
    });
    mockPrisma.ipBlacklist.delete.mockResolvedValue({});
    mockPrisma.loginAttempt.count.mockResolvedValue(0);

    const result = await checkAndEnforceRateLimit("192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(mockPrisma.ipBlacklist.delete).toHaveBeenCalledWith({ where: { ip: "192.168.1.1" } });
  });

  it("blacklists IP after 2 login attempts in one hour", async () => {
    mockPrisma.ipBlacklist.findUnique.mockResolvedValue(null);
    mockPrisma.loginAttempt.count.mockResolvedValue(2);
    mockPrisma.ipBlacklist.create.mockResolvedValue({});

    const result = await checkAndEnforceRateLimit("10.0.0.1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("超限");
    expect(mockPrisma.ipBlacklist.create).toHaveBeenCalled();
  });

  it("records login attempt", async () => {
    mockPrisma.loginAttempt.create.mockResolvedValue({});

    await recordLoginAttempt("192.168.1.1", "test@test.com", false);
    expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
      data: { ip: "192.168.1.1", email: "test@test.com", success: false },
    });
  });
});

describe("Password Hashing", () => {
  it("hashes password and verifies correctly", async () => {
    const plainPassword = "testpassword123";
    const hashedPassword = await hash(plainPassword, 12);

    expect(hashedPassword).not.toBe(plainPassword);
    expect(hashedPassword.startsWith("$2b$")).toBe(true);

    const isValid = await compare(plainPassword, hashedPassword);
    expect(isValid).toBe(true);

    const isInvalid = await compare("wrongpassword", hashedPassword);
    expect(isInvalid).toBe(false);
  });
});
