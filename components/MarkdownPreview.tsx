"use client";

import { createContext, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const InsidePreContext = createContext(false);

type MarkdownPreviewProps = {
  markdown: string | null;
  isLoading: boolean;
  unstyled?: boolean;
};

export function MarkdownPreview({ markdown, isLoading, unstyled }: MarkdownPreviewProps) {
  const content = (
    <div className={unstyled ? "min-h-0 flex-1 overflow-auto" : "min-h-0 flex-1 overflow-auto px-5 py-4"}>
      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-surface-1 text-sm text-ink-muted">
          正在等待模型返回 Markdown。
        </div>
      ) : markdown ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ children }) {
              const insidePre = useContext(InsidePreContext);
              if (insidePre) {
                return <code className="font-mono text-sm">{children}</code>;
              }
              return (
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-ink">
                  {children}
                </code>
              );
            },
            h1({ children }) {
              return (
                <h1 className="mb-4 mt-2 text-2xl font-semibold leading-tight text-ink">
                  {children}
                </h1>
              );
            },
            h2({ children }) {
              return (
                <h2 className="mb-3 mt-6 text-xl font-semibold leading-snug text-ink">
                  {children}
                </h2>
              );
            },
            h3({ children }) {
              return (
                <h3 className="mb-2 mt-5 text-lg font-semibold leading-snug text-ink">
                  {children}
                </h3>
              );
            },
            li({ children }) {
              return <li className="pl-1 leading-7">{children}</li>;
            },
            ol({ children }) {
              return (
                <ol className="my-3 list-decimal space-y-1 pl-6">
                  {children}
                </ol>
              );
            },
            p({ children }) {
              return <p className="my-3 leading-7 text-ink/80">{children}</p>;
            },
            pre({ children }) {
              return (
                <InsidePreContext.Provider value={true}>
                  <pre className="my-4 overflow-auto rounded-lg bg-surface-2 p-4 text-sm leading-6 text-white">
                    {children}
                  </pre>
                </InsidePreContext.Provider>
              );
            },
            ul({ children }) {
              return (
                <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>
              );
            },
            table({ children }) {
              return (
                <div className="my-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    {children}
                  </table>
                </div>
              );
            },
            thead({ children }) {
              return <thead className="bg-surface-2">{children}</thead>;
            },
            tbody({ children }) {
              return <tbody>{children}</tbody>;
            },
            tr({ children }) {
              return (
                <tr className="border-b border-ink/10 even:bg-ink/[0.02]">
                  {children}
                </tr>
              );
            },
            th({ children }) {
              return (
                <th className="px-3 py-2 text-left font-semibold text-ink">
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td className="px-3 py-2 text-ink/80">{children}</td>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      ) : (
        <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-line bg-surface-1 text-sm text-ink-muted">
          暂无报告。提交输入后，模型返回的 Markdown 会显示在这里。
        </div>
      )}
    </div>
  );

  if (unstyled) {
    return content;
  }

  return (
    <section className="flex min-h-[420px] flex-col rounded-lg border border-line bg-surface-1 shadow-sm">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">Markdown Preview</h2>
      </header>
      {content}
    </section>
  );
}
