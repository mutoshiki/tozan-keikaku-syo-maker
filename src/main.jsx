import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.scss';
import App from './App.jsx';
import ThemeToggle from './ThemeToggle.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ThemeToggle />
  </React.StrictMode>,
);
