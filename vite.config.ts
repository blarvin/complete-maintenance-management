import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { precachePlugin } from './vite-plugin-precache';

export default defineConfig(() => {
    return {
        plugins: [
            solid(),
            precachePlugin({ swSource: 'src/service-worker.ts' }),
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
