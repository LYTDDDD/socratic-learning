"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Tab = "model" | "database";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("model");

  const [modelConfig, setModelConfig] = useState({
    baseUrl: "",
    model: "",
    apiKeySet: false,
  });
  const [apiKey, setApiKey] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [dbConnected, setDbConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchModelConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/model");
      if (res.ok) {
        const data = await res.json();
        setModelConfig(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchDbConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/database");
      if (res.ok) {
        const data = await res.json();
        setDbUrl(data.url || "");
        setDbConnected(data.connected);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchModelConfig();
    fetchDbConfig();
  }, [status, fetchModelConfig, fetchDbConfig]);

  const handleSaveModel = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const body: Record<string, string> = {};
      if (apiKey) body.apiKey = apiKey;
      if (modelConfig.baseUrl) body.baseUrl = modelConfig.baseUrl;
      if (modelConfig.model) body.model = modelConfig.model;

      const res = await fetch("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setApiKey("");
        fetchModelConfig();
      } else {
        setError(data.error);
      }
    } catch {
      setError("保存失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDb = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/settings/database", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dbUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setDbConnected(data.connected);
        fetchDbConfig();
      } else {
        setError(data.error);
      }
    } catch {
      setError("保存失败");
    } finally {
      setLoading(false);
    }
  };

  const handleTestDb = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/settings/database", { method: "POST" });
      const data = await res.json();
      setDbConnected(data.connected);
      if (data.connected) {
        setMessage("数据库连接测试成功");
      } else {
        setError(data.error || "数据库连接失败");
      }
    } catch {
      setError("连接测试失败");
      setDbConnected(false);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">加载中...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">系统设置</h1>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            返回首页
          </button>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab("model")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "model"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            模型配置
          </button>
          <button
            onClick={() => setActiveTab("database")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "database"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            数据库配置
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "model" && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">模型配置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={modelConfig.apiKeySet ? "已设置，留空则不修改" : "输入 API Key"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={modelConfig.baseUrl}
                  onChange={(e) => setModelConfig({ ...modelConfig, baseUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  模型名称
                </label>
                <input
                  type="text"
                  value={modelConfig.model}
                  onChange={(e) => setModelConfig({ ...modelConfig, model: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="gpt-4o-mini"
                />
              </div>

              <button
                onClick={handleSaveModel}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "保存中..." : "保存模型配置"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "database" && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">数据库配置</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">连接状态：</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  dbConnected
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dbConnected ? "bg-green-500" : "bg-red-500"}`} />
                  {dbConnected ? "已连接" : "未连接"}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PostgreSQL 连接字符串
                </label>
                <input
                  type="password"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="postgresql://user:password@localhost:5432/dbname"
                />
                <p className="mt-1 text-xs text-slate-400">
                  格式：postgresql://用户名:密码@主机:端口/数据库名
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveDb}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "保存中..." : "保存配置"}
                </button>
                <button
                  onClick={handleTestDb}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  测试连接
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
