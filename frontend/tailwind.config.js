// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  plugins: [
    require("daisyui"),
  ],

  daisyui: {
    themes: ["luxury --default --prefersdark", "light"],
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: false,
  },
};
