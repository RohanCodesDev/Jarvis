import React from 'react';
import ReactDOM from 'react-dom/client';
import { JarvisHUD } from './ui';
import './styles/globals.css';
import './styles/hud.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to locate #root DOM element');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <JarvisHUD />
  </React.StrictMode>
);

