import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.js';  // i18next başlatma — App'ten önce yüklenmeli
import './index.css';
import './operio-original.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
