import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '14px',
              boxShadow:
                '0 4px 6px -2px rgba(15, 23, 42, 0.05), 0 10px 15px -3px rgba(15, 23, 42, 0.08)',
              border: '1px solid #F1F5F9',
            },
            success: {
              iconTheme: { primary: '#04C99E', secondary: '#fff' },
              style: { background: '#F0FDF9', color: '#055F4A' },
            },
            error: {
              iconTheme: { primary: '#E11D48', secondary: '#fff' },
              style: { background: '#FFF1F2', color: '#9F1239' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
