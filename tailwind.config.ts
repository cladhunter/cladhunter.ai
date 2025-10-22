import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./styles/**/*.{ts,tsx,css}",
    "./utils/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
