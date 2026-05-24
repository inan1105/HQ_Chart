import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        up: "#ef4444",
        down: "#3b82f6",
        surface: "#111827",
        panel: "#1f2937",
        border: "#374151",
      },
    },
  },
  plugins: [],
};

export default config;
