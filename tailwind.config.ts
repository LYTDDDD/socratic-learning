import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#e4e6ef",
        "ink-muted": "#8b93a7",
        paper: "#0f1117",
        "paper-warm": "#171b23",
        "paper-cool": "#202633",
        moss: "#10b981",
        "moss-light": "#34d399",
        "moss-dark": "#059669",
        rust: "#f59e0b",
        "rust-light": "#fbbf24",
        line: "rgba(255,255,255,0.08)",
        "surface-0": "#0f1117",
        "surface-1": "#171b23",
        "surface-2": "#202633",
        "surface-3": "#2a3042",
        blue: "#3b82f6",
        green: "#10b981",
        amber: "#f59e0b",
        red: "#ef4444",
        glow: "rgba(59,130,246,0.15)",
        border: "var(--border)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: "var(--destructive)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(59,130,246,0.15)",
        "glow-sm": "0 0 10px rgba(59,130,246,0.1)",
        "glow-green": "0 0 20px rgba(16,185,129,0.15)",
        "glow-amber": "0 0 20px rgba(245,158,11,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
