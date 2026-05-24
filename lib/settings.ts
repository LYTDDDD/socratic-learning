import prisma from "./prisma";

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const SETTING_KEY_API_KEY = "openai_api_key";
const SETTING_KEY_BASE_URL = "openai_base_url";
const SETTING_KEY_MODEL = "openai_model";

export async function getModelConfig(): Promise<ModelConfig> {
  const [apiKeySetting, baseUrlSetting, modelSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: SETTING_KEY_API_KEY } }),
    prisma.appSetting.findUnique({ where: { key: SETTING_KEY_BASE_URL } }),
    prisma.appSetting.findUnique({ where: { key: SETTING_KEY_MODEL } }),
  ]);

  return {
    apiKey: apiKeySetting?.value || process.env.OPENAI_API_KEY || "",
    baseUrl: baseUrlSetting?.value || process.env.OPENAI_BASE_URL || "",
    model: modelSetting?.value || process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

export async function saveModelConfig(config: Partial<ModelConfig>): Promise<void> {
  const ops = [];
  if (config.apiKey !== undefined) {
    ops.push(prisma.appSetting.upsert({
      where: { key: SETTING_KEY_API_KEY },
      update: { value: config.apiKey },
      create: { key: SETTING_KEY_API_KEY, value: config.apiKey },
    }));
  }
  if (config.baseUrl !== undefined) {
    ops.push(prisma.appSetting.upsert({
      where: { key: SETTING_KEY_BASE_URL },
      update: { value: config.baseUrl },
      create: { key: SETTING_KEY_BASE_URL, value: config.baseUrl },
    }));
  }
  if (config.model !== undefined) {
    ops.push(prisma.appSetting.upsert({
      where: { key: SETTING_KEY_MODEL },
      update: { value: config.model },
      create: { key: SETTING_KEY_MODEL, value: config.model },
    }));
  }
  await Promise.all(ops);
}

export async function getDatabaseConfig(): Promise<{ url: string; connected: boolean }> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "database_url" } });
  return {
    url: setting?.value || process.env.DATABASE_URL || "",
    connected: true,
  };
}

export async function saveDatabaseConfig(url: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "database_url" },
    update: { value: url },
    create: { key: "database_url", value: url },
  });
}
