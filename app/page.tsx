import { AnalysisWorkbench } from "../components/AnalysisWorkbench";

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6">
        <header className="border-b border-line pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rust">
            Cognitive Asset Lab
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
            离线任务分析工作台
          </h1>
        </header>

        <AnalysisWorkbench />
      </section>
    </main>
  );
}
