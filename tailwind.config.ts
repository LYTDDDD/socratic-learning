import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#18202f",
        paper: "#f7f4ec",
        moss: "#49654c",
        rust: "#9b4f2f",
        line: "#d8d2c5",
      },
    },
  },
  plugins: [],
};

export default config;
