import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
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
    const { email, password, name, action } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码不能为空" }, { status: 400 });
    }

    if (action === "register") {
      if (!name || name.trim().length < 2) {
        return NextResponse.json({ error: "用户名至少 2 个字符" }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json({ error: "密码至少 8 个字符" }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await recordLoginAttempt(ip, email, false);
        return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
      }

      const hashedPassword = await hash(password, 12);
      const user = await prisma.user.create({
        data: { name: name.trim(), email, password: hashedPassword },
      });

      return NextResponse.json({
        message: "注册成功",
        user: { id: user.id, name: user.name, email: user.email },
      }, { status: 201 });
    }

    if (action === "login") {
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
    }

    return NextResponse.json({ error: "无效的操作" }, { status: 400 });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
