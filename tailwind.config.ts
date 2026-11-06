import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    /** Include shared modules that contribute class strings (e.g. CRM kanban swatch colors) */
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
