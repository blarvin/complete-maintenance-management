import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet, ServiceWorkerRegister } from '@builder.io/qwik-city';
import './styles/tokens.css';
import './styles/global.css';
import { useProvideAppState } from './state/appState';
import { useInitStorage } from './hooks/useInitStorage';

export default component$(() => {
    useProvideAppState();
    useInitStorage(); // Initialize IDB storage and SyncManager on client
    return (
        <QwikCityProvider>
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />

                {/* PWA Manifest */}
                <link rel="manifest" href="/manifest.json" />

                {/* PWA Meta Tags */}
                <meta name="theme-color" content="#1a1a1a" />
                <meta name="description" content="Hierarchical maintenance tracking for physical assets" />

                {/* iOS Safari PWA Support */}
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="CMM" />
                <link rel="apple-touch-icon" href="/icon-192.png" />
                <meta name="mobile-web-app-capable" content="yes" />

                {/* Service Worker Registration */}
                <ServiceWorkerRegister />
            </head>
            <body>
                <RouterOutlet />
            </body>
        </QwikCityProvider>
    );
});
