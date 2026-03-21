import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './LiveTalk-main/App';

// تسجيل Service Worker لتمكين PWA بشكل احترافي
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('LiveTalk PWA Registered!', reg.scope);
        // التحقق من وجود تحديثات في الخلفية
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New content available; please refresh.');
              }
            };
          }
        };
      })
      .catch(err => console.log('PWA Register Error:', err));
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);