import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ArcPay brand — single accent, everything else is neutral
        primary: {
          DEFAULT: "#6c47ff",
          foreground: "#ffffff",
          light: "#ede9ff",
        },
        arc: {
          // Arc-specific reference colours used in copy
          usdc: "#2775CA",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease",
      },
    },
  },
  plugins: [],
};

export default config;
