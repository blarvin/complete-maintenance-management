import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';
import './styles/global.css';
import { useProvideAppState } from './state/appState';

export default component$(() => {
    useProvideAppState();
    return (
        <QwikCityProvider>
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body>
                <RouterOutlet />
            </body>
        </QwikCityProvider>
    );
});
