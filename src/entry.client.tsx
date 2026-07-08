/**
 * Client entry — mounts the Solid app and registers the service worker.
 */

import { render } from 'solid-js/web';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';

render(() => <App />, document.getElementById('app')!);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/service-worker.js');
    });
}
