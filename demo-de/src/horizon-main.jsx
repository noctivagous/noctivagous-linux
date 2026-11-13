import React from 'react';
import { createRoot } from 'react-dom/client';
import HorizonApp from './HorizonApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HorizonApp />
  </React.StrictMode>,
);
