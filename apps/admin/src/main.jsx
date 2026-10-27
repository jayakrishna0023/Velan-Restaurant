import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@velan/shared/styles/index.css';
import { LangProvider } from '@velan/shared/i18n.jsx';
import { COPY } from './copy.js';
import App from './App.jsx';
import './styles/admin.css';
import './styles/pages.css';
import '@velan/shared/styles/poster-kit.css';
import './styles/poster.css';

const basename = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') ? '/admin' : '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider dict={COPY}>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
);
