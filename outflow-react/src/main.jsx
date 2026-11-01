import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { OutflowProvider } from './store/useOutflowStore.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OutflowProvider>
      <App />
    </OutflowProvider>
  </React.StrictMode>
);
