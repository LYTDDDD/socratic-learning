import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { getDatabaseConfig, saveDatabaseConfig } from "../../../../lib/settings";
import prisma from "../../../../lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const config = await getDatabaseConfig();
    const maskedUrl = config.url
      ? config.url.replace(/:([^@]+)@/, ":****@")
      : "";

    return NextResponse.json({
      url: maskedUrl,
      connected: config.connected,
    });
  } catch (error) {
    console.error("Get database config error:", error);
    return NextResponse.json({
      url: "",
      connected: false,
      error: "数据库连接失败",
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "数据库连接字符串不能为空" }, { status: 400 });
    }

    const postgresPattern = /^postgresql:\/\/.+/;
    if (!postgresPattern.test(url)) {
      return NextResponse.json({ error: "连接字符串必须以 postgresql:// 开头" }, { status: 400 });
    }

    await saveDatabaseConfig(url);

    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({ message: "数据库配置已保存，连接测试成功", connected: true });
    } catch {
      return NextResponse.json({ message: "配置已保存，但连接测试失败", connected: false }, { status: 200 });
    }
  } catch (error) {
    console.error("Save database config error:", error);
    return NextResponse.json({ error: "保存数据库配置失败" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ connected: true, message: "数据库连接正常" });
  } catch {
    return NextResponse.json({ connected: false, error: "数据库连接失败" }, { status: 503 });
  }
}
