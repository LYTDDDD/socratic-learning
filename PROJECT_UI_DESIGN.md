# PROJECT_UI_DESIGN.md

## 1. Product UI Positioning

Cognitive Asset Lab is an AI cognitive workbench for turning conversations into inspectable mission reviews and reusable cognitive assets. It is not a personal homepage, portfolio, resume, or marketing landing page.

The interface should feel like a focused analysis console: structured, traceable, calm, and warm enough for repeated thinking work.

## 2. Core User Flow

1. Start in Chat Workspace or paste mission context and conversation into Offline Analysis.
2. Use Review Handoff to send a meaningful conversation into Offline Analysis when the chat becomes review-worthy.
3. Run single prompt or multi-agent analysis.
4. Read the Markdown report first.
5. Inspect Evidence Trail, JSON, model original output, agent steps, and run log only when needed.
6. Review the asset candidate as AI-generated reference material.
7. Let the user confirm, correct, or rewrite before any asset is treated as owned understanding.
8. Organize reviewed reports and generated assets through Mission Workspace and Report History.

## 3. Page Architecture

The app has two primary work modes:

- Offline Analysis Workbench: structured report generation, review, evidence, correction, and asset handling.
- Chat Workspace: exploratory conversation capture, conversation list, active thread, and Review Handoff.

Offline Analysis Workbench:

- Left rail: Workflow navigation, input, Report History, and Mission Workspace.
- Center stage: report reader with Markdown as the default surface.
- Right rail: Evidence Trail, run status, trace summary, correction, preference rules, Review Mode, and Asset Library.

Chat Workspace:

- Left rail: Conversation Workspace list and session controls.
- Center stage: active conversation.
- Right rail: Review Handoff, current context, and readiness signals.

Future pages may split reports, assets, run logs, missions, review mode, and settings into dedicated routes. The current screen should remain a usable workbench, not a dashboard showcase.

## 4. Layout System

- Use full-height application layout, not a hero section.
- Keep three stable zones: navigation, workbench controls, reading surface.
- Let Markdown report occupy the largest visual area.
- Keep JSON and model original output behind tabs.
- Offline Analysis on narrow screens should stack Workflow and input first, report second, operational panels last.
- Chat Workspace on narrow screens should stack conversation list first, active conversation second, Review Handoff last.
- Repeated status counters and toolbars need stable dimensions so labels, hover states, and loading text do not shift the layout.

## 5. Information Density Rules

- Default density is medium: enough context to work, not every object expanded.
- Run logs, model original output, and AI-suggested connection detail should be secondary.
- Required fields must be visible without scanning long prose.
- Empty states should state what will appear next, not explain the whole product.

## 6. Color Tokens

Use the current dark workbench tokens:

- `surface-0`: app background.
- `surface-1`: primary panels.
- `surface-2`: nested fields and empty states.
- `ink`: primary text.
- `ink-muted`: supporting text.
- `blue`: active analysis and primary action.
- `moss`: confirmed asset or success states.
- `amber`: warning, parse issue, user attention.
- `red`: destructive or failed states.
- `line`: quiet borders.

Avoid single-hue purple gradients, marketing-style glow backgrounds, and decorative blobs.

## 7. Typography

- Use compact headings in panels.
- Use larger type only for the active report title or workbench title.
- Preserve readable line height in Markdown reports.
- Use mono only for run IDs, JSON, model original output, and code snippets.
- Do not scale font size with viewport width.

## 8. Card System

- Cards are for individual repeated objects, candidate assets, review records, and collapsible operational panels.
- Avoid cards nested inside decorative cards.
- Operational panels use subtle backgrounds and tight headers.
- Asset candidate cards must visibly indicate AI-generated reference status.

## 9. Mother Card / SubCard Design

Mother Card:

- Full understanding, evidence, revisions, maturity, and usage history.
- Should preserve the complete reasoning context.

Knowledge SubCard:

- Lightweight Markdown note for recall and quick application.
- Shows title and core point by default.
- Expands to examples, application scenarios, and trigger signals.
- Never replaces the mother card.

## 10. User-first Connection UI Rules

- User-written connections come before AI suggestions.
- AI suggestions are hints, not saved truth.
- Do not auto-fill `user_built_connections` from AI output.
- Do not auto-upgrade maturity.
- When asking for a connection, show a concrete prompt and a low-friction input.

## 11. Report Reading Experience

- Markdown is the default report view.
- Mission Review and DepthScore should be easy to scan.
- Tables must remain horizontally scrollable.
- Long reports should feel like an analysis document, not a JSON dump.

## 12. JSON Viewer Rules

- JSON is for inspection and debugging.
- Keep it behind a tab.
- On parse failure, show a clear warning and provide model original output access.
- Do not let JSON compete with Markdown as the primary reading surface.

## 13. Run Log Display Rules

- Default to compact summary.
- Expand only when user needs traceability.
- Failure states should be more visible than success states.
- Never expose secrets.
- Show run ID, prompt version, model, status, duration, and error if present.

## 14. Motion System

- Motion should clarify state changes.
- Use simple opacity and slight translate transitions.
- Avoid constant looping animation.
- Loading states should communicate waiting clearly and offer cancellation for long work.

## 15. Empty / Loading / Error States

- Empty: tell the user what will appear after the next action.
- Chat empty state should point to creating or selecting a conversation.
- Report History empty state should say reports appear after analysis runs.
- Mission empty state should say a mission organizes reports, review status, and assets.
- Loading: show current phase and allow cancel when a request is in flight.
- Success: keep the reader focused on the report.
- Error: show the actionable reason when available.

## 16. Terminology Rules

- Use English section markers for stable product concepts: `Workflow`, `Report History`, `Mission Workspace`, `Conversation Workspace`, `Review Handoff`, `Evidence Trail`, and `Asset Library`.
- Pair those markers with concise Chinese operational labels where helpful.
- Keep user-facing copy short and action-oriented.
- Avoid rephrasing the same concept with multiple names across panels and tests.

## 17. Mobile Rules

- Do not rely on hover-only controls.
- Touch targets should be at least 44px when practical.
- Stack left, center, and right panels.
- Keep report text readable and avoid horizontal overflow except for tables/code.

## 18. Do / Don't

Do:

- Build a product workbench.
- Prioritize analysis, assets, evidence, and traceability.
- Keep AI-generated content clearly marked as draft/reference until user action.
- Use restrained, durable visual styling.

Don't:

- Build a personal brand site.
- Add portfolio, contact, blog, or marketing sections.
- Use a hero section as the main experience.
- Auto-save AI candidate connections as user-owned understanding.
- Auto-upgrade maturity.
