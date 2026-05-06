import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { OutletProvider } from './context/OutletContext';
import { PermissionProvider } from './context/PermissionContext';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
// Toaster is lazy-loaded so `react-hot-toast` (~3.9 kB gzip) lands in
// a separate chunk fetched on-demand instead of the eager bundle.
// `react-hot-toast`'s store accepts `toast(...)` calls made before
// the Toaster mounts and renders them when it does, so the user-
// visible behaviour is unchanged. See `apps/web/src/utils/toast.js`
// for the matching `toast` callable wrapper used by the eager
// `LoginPage`.
import { Toaster } from './utils/toast';
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
              <Suspense fallback={null}>
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
              </Suspense>
            </OutletProvider>
          </PermissionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
