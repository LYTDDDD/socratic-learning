import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock("../lib/prisma", () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { getModelConfig, saveModelConfig, getDatabaseConfig, saveDatabaseConfig } from "../lib/settings";

describe("Settings - Model Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns model config with defaults from env", async () => {
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);

    const config = await getModelConfig();
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("baseUrl");
    expect(config).toHaveProperty("model");
  });

  it("returns model config from database when set", async () => {
    mockPrisma.appSetting.findUnique
      .mockResolvedValueOnce({ key: "openai_api_key", value: "sk-test123" })
      .mockResolvedValueOnce({ key: "openai_base_url", value: "https://api.test.com/v1" })
      .mockResolvedValueOnce({ key: "openai_model", value: "gpt-4o" });

    const config = await getModelConfig();
    expect(config.apiKey).toBe("sk-test123");
    expect(config.baseUrl).toBe("https://api.test.com/v1");
    expect(config.model).toBe("gpt-4o");
  });

  it("saves model config to database", async () => {
    mockPrisma.appSetting.upsert.mockResolvedValue({});

    await saveModelConfig({
      apiKey: "sk-new",
      baseUrl: "https://new.api.com",
      model: "gpt-4o-mini",
    });

    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledTimes(3);
  });
});

describe("Settings - Database Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns database config", async () => {
    mockPrisma.appSetting.findUnique.mockResolvedValue({
      key: "database_url",
      value: "postgresql://user:pass@localhost:5432/test",
    });

    const config = await getDatabaseConfig();
    expect(config.url).toBe("postgresql://user:pass@localhost:5432/test");
    expect(config.connected).toBe(true);
  });

  it("saves database config", async () => {
    mockPrisma.appSetting.upsert.mockResolvedValue({});

    await saveDatabaseConfig("postgresql://new:pass@localhost:5432/newdb");

    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "database_url" },
        create: expect.objectContaining({ value: "postgresql://new:pass@localhost:5432/newdb" }),
      }),
    );
  });
});
