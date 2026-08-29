import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Keep lazy chunks and CSS portable. Laravel resolves the entry asset URL
    // from the current HTTP request when it renders the page.
    base: './',
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
});
