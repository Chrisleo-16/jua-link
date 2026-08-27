import type { Config } from "tailwindcss";

// Design tokens shared by shadcn/ui-style components AND any AlignUI
// components you paste in later — keep this file the single source of
// truth for color so the two systems never drift apart visually.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette from the concept brief
        charcoal: {
          DEFAULT: "#1F2320",
          soft: "#2E332F",
        },
        forest: {
          DEFAULT: "#215B44",
          soft: "#EAF3EE",
        },
        rust: {
          DEFAULT: "#C1571B",
          soft: "#FBEBE0",
        },
        gold: {
          DEFAULT: "#C9A227",
          soft: "#F8F1DC",
        },
        // Semantic tokens — components should reference these, not raw colors,
        // so a future theme change is a one-line edit here.
        background: "#FAF8F4",
        foreground: "#1F2320",
        border: "#E4E0D6",
        muted: "#F0ECE1",
        "muted-foreground": "#6B6459",
        primary: {
          DEFAULT: "#215B44",
          foreground: "#FAF8F4",
        },
        secondary: {
          DEFAULT: "#C1571B",
          foreground: "#FAF8F4",
        },
        destructive: {
          DEFAULT: "#B3261E",
          foreground: "#FAF8F4",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
