import React from 'react';
import { createRoot } from 'react-dom/client';
import IgeoLiveApp from './IgeoLiveApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IgeoLiveApp />
  </React.StrictMode>,
);
