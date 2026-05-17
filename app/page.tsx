import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HeroSection } from "@/components/showcase/HeroSection";
import { CurrentFocusSection } from "@/components/showcase/CurrentFocusSection";
import { FeaturedProjectsSection } from "@/components/showcase/FeaturedProjectsSection";
import { ThinkingAssetsSection } from "@/components/showcase/ThinkingAssetsSection";
import { ExperienceTimeline } from "@/components/showcase/ExperienceTimeline";
import { ProofSection } from "@/components/showcase/ProofSection";
import { ContactSection } from "@/components/showcase/ContactSection";

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="sticky top-0 z-50 border-b border-line/60 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-moss" />
            <span className="font-heading text-sm font-semibold tracking-wide text-ink">
              Cognitive Asset Lab
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/lab"
              className="text-sm font-medium text-ink-muted transition hover:text-ink"
            >
              实验室
            </Link>
            <a
              href="https://github.com/LYTDDDD/socratic-learning"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-muted transition hover:text-ink"
            >
              <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.747.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </nav>

      <HeroSection />
      <CurrentFocusSection />
      <FeaturedProjectsSection />
      <ThinkingAssetsSection />
      <ExperienceTimeline />
      <ProofSection />
      <ContactSection />

      <footer className="border-t border-line/60 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-moss" />
              <span className="text-xs text-ink-muted">
                Cognitive Asset Lab © {new Date().getFullYear()}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              构建判断力，不只是知识
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
