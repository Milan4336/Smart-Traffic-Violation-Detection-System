/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#00F0FF",
                alert: "#FF2A6D",
                success: "#05FFA1",
                background: {
                    light: "#f5f8f8",
                    dark: "#050A14",
                },
                surface: {
                    dark: "rgba(15, 23, 42, 0.6)",
                }
            },
            fontFamily: {
                display: ["Rajdhani", "sans-serif"],
                body: ["Inter", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            boxShadow: {
                'neon': '0 0 10px rgba(0, 240, 255, 0.5)',
                'neon-alert': '0 0 10px rgba(255, 42, 109, 0.5)',
            }
        },
    },
    plugins: [],
}
