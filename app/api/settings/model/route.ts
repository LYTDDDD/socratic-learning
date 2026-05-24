import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { getModelConfig, saveModelConfig } from "../../../../lib/settings";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const config = await getModelConfig();
    return NextResponse.json({
      baseUrl: config.baseUrl,
      model: config.model,
      apiKeySet: config.apiKey.length > 0,
    });
  } catch (error) {
    console.error("Get model config error:", error);
    return NextResponse.json({ error: "获取模型配置失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, baseUrl, model } = body;

    if (baseUrl !== undefined && typeof baseUrl !== "string") {
      return NextResponse.json({ error: "baseUrl 必须是字符串" }, { status: 400 });
    }
    if (model !== undefined && typeof model !== "string") {
      return NextResponse.json({ error: "model 必须是字符串" }, { status: 400 });
    }
    if (apiKey !== undefined && typeof apiKey !== "string") {
      return NextResponse.json({ error: "apiKey 必须是字符串" }, { status: 400 });
    }

    await saveModelConfig({ apiKey, baseUrl, model });
    return NextResponse.json({ message: "模型配置已保存" });
  } catch (error) {
    console.error("Save model config error:", error);
    return NextResponse.json({ error: "保存模型配置失败" }, { status: 500 });
  }
}
