import React from 'react';
import { createRoot } from 'react-dom/client';
import { Layer } from '@carbon/react';
import App from './App.jsx';
import { ThemePreferenceProvider } from './ThemeToggle.jsx';
import './styles.scss';
import '../export-fixes.css';

createRoot(document.getElementById('root')).render(
  <ThemePreferenceProvider>
    <Layer level={0}>
      <App />
    </Layer>
  </ThemePreferenceProvider>,
);
