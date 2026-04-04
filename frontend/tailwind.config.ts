import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Slate-inspired dark theme (from MkDocs Material slate/green/indigo)
        watchr: {
          // Backgrounds
          "bg-primary": "var(--bg-primary)",
          "bg-secondary": "var(--bg-secondary)",
          "bg-surface": "var(--bg-surface)",
          // Text
          "text-primary": "var(--text-primary)",
          "text-secondary": "var(--text-secondary)",
          // Accents
          green: "var(--accent-primary)",
          indigo: "var(--accent-secondary)",
          // Border
          border: "var(--border)",
        },
      },
      fontFamily: {
        sans: ["Roboto", "system-ui", "sans-serif"],
        mono: ["Roboto Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
