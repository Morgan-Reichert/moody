import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Moody brand green (from the logo)
        brand: {
          50: "#eafaef",
          100: "#d0f4dc",
          200: "#a3e8bd",
          300: "#6fd897",
          400: "#3ec574",
          500: "#1aad55",
          600: "#128a43",
          700: "#106e37",
          800: "#12572e",
          900: "#0f4727",
        },
        ink: {
          DEFAULT: "#16211b",
          soft: "#53625a",
          mute: "#8a978f",
        },
        cream: "#eef2ec",       // app background base
        surface: "#ffffff",
        // soft pastel category tints
        mint: "#d9f0e0",
        peach: "#fbe2d3",
        lilac: "#e7e3f5",
        butter: "#f6ecc9",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-rounded", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-rounded", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        soft: "0 10px 34px -14px rgba(20,50,35,.18)",
        card: "0 6px 22px -10px rgba(20,50,35,.16)",
        pill: "0 12px 30px -8px rgba(16,40,28,.45)",
        glow: "0 14px 30px -10px rgba(26,173,85,.55)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        pop: { "0%": { transform: "scale(.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        pulseRing: { "0%,100%": { transform: "scale(1)", opacity: "1" }, "50%": { transform: "scale(1.06)", opacity: ".85" } },
        sheetUp: { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        rise: "rise .55s cubic-bezier(.22,.61,.36,1) both",
        pop: "pop .3s cubic-bezier(.34,1.56,.64,1) both",
        pulseRing: "pulseRing 1.1s ease-in-out infinite",
        sheetUp: "sheetUp .38s cubic-bezier(.32,.72,0,1)",
      },
    },
  },
  plugins: [],
};

export default config;
