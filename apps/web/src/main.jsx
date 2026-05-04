import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { OutletProvider } from './context/OutletContext';
import { PermissionProvider } from './context/PermissionContext';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
import './index.css';

initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary scope="app">
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <PermissionProvider>
            <OutletProvider>
              <App />
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3000,
                  style: {
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '14px',
                  },
                }}
              />
            </OutletProvider>
          </PermissionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
