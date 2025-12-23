import { defineConfig } from 'vite';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { qwikVite } from '@builder.io/qwik/optimizer';

export default defineConfig(() => {
    return {
        plugins: [qwikCity(), qwikVite()],
        server: {
            allowedHosts: ['host.docker.internal'],
        },
    };
});


