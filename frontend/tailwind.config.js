/** @type {import('tailwindcss').Config} */
module.exports = {
  // Was app/**/* only — components/ and lib/ use Tailwind classes too (StatusBadge, NavBar, etc.)
  // and were silently at risk of being purged from the production build.
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
