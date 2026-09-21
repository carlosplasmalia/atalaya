/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        panel: "#020602",
        line: "#0d3b0d",
        ink: "#00ff41",
        dim: "#008f11",
        deep: "#004d0a",
        accent: "#ffb000",
        danger: "#ff003c",
        signal: "#00ff41",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "SF Mono", "Menlo", "monospace"],
        display: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
