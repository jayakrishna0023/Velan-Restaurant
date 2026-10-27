import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@velan/shared/styles/index.css';
import { LangProvider } from '@velan/shared/i18n.jsx';
import { COPY } from './copy.js';
import App from './App.jsx';
import './styles/rider.css';
import '@velan/shared/styles/poster-kit.css';
import './styles/poster.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider dict={COPY}>
      <App />
    </LangProvider>
  </StrictMode>,
);
