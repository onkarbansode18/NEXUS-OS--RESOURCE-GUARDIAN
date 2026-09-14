/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nexus design tokens — match CSS custom properties exactly
        bg: "#F6F7F9",
        surface: "#FFFFFF",
        "text-primary": "#12161C",
        "text-secondary": "#5B6472",
        border: "#E1E4EA",
        healthy: "#1F7A5C",
        warning: "#C2622A",
        critical: "#B23B3B",
        info: "#3A5CA8",
      },
      fontFamily: {
        grotesk: ["Space Grotesk", "sans-serif"],
        plex: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        vitals: "0 1px 4px 0 rgba(18,22,28,0.06), 0 4px 16px 0 rgba(18,22,28,0.08)",
      },
      keyframes: {
        pulse_dot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        pulse_dot: "pulse_dot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
