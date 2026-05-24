import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import prisma from "../../../../lib/prisma";
import { getClientIp, checkAndEnforceRateLimit, recordLoginAttempt } from "../../../../lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rateCheck = await checkAndEnforceRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await recordLoginAttempt(ip, email, false);
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      await recordLoginAttempt(ip, email, false);
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    await recordLoginAttempt(ip, email, true);
    return NextResponse.json({
      message: "登录验证通过",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
