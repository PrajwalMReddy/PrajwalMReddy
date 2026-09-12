import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
                console.log('PWA ServiceWorker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.warn('PWA ServiceWorker registration failed:', error);
            });
    });
}