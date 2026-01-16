import { defineConfig } from 'vite';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { precachePlugin } from './vite-plugin-precache';

export default defineConfig(() => {
    return {
        plugins: [
            qwikCity({
                // Static site generation for PWA
                // Service worker + IndexedDB handle dynamic behavior
            }),
            qwikVite(),
            precachePlugin(),
        ],
        server: {
            allowedHosts: ['host.docker.internal'],
        },
        preview: {
            headers: {
                'Cache-Control': 'public, max-age=600',
            }
        }
    };
});


