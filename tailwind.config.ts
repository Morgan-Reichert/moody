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
        // Vert Moody, éclairci façon "lime" du moodboard
        brand: {
          50: "#f0faea",
          100: "#e0f6d3",
          200: "#c4edab",
          300: "#9ade79",
          400: "#74d052",
          500: "#55be3c",
          600: "#3f9a2c",
          700: "#357c27",
          800: "#2c6222",
          900: "#24501e",
        },
        // Bleu vif des jauges & anneaux (progression)
        accent: {
          DEFAULT: "#477bff",
          deep: "#2f5fe0",
          soft: "#dfe8ff",
        },
        ink: {
          DEFAULT: "#141519",
          soft: "#5d6169",
          mute: "#989ca6",
        },
        cream: "#f2f3f6",       // fond de page gris perle
        surface: "#ffffff",
        // tuiles pastel froides
        mint: "#daf4c4",        // vert tilleul (héros)
        peach: "#ffd9e7",       // rose dragée
        lilac: "#c9d8ff",       // bleu pervenche
        butter: "#ffeec2",      // jaune sable
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-rounded", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-rounded", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.65rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 14px 40px -18px rgba(22,26,40,.14)",
        card: "0 2px 14px -4px rgba(22,26,40,.07)",
        pill: "0 12px 32px -10px rgba(20,22,32,.28)",
        glow: "0 10px 26px -8px rgba(20,21,25,.38)",
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
