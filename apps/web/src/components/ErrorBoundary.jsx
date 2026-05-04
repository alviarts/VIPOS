// VIPOS — Generic React error boundary (PR-1, pra-beta v0.0.1).
//
// Wrap any subtree in <ErrorBoundary> so that an uncaught render-time
// exception in a child shows a friendly fallback UI instead of a blank
// white screen. When Sentry is initialized via `lib/sentry.js`, the
// caught error + componentStack is automatically forwarded for triage.
//
// Two scopes are supported:
//   <ErrorBoundary scope="app">    — full-screen fallback (use at the
//                                     <App /> root in main.jsx).
//   <ErrorBoundary scope="route">  — inline fallback that fits inside an
//                                     authenticated route's main area, so
//                                     the sidebar + header stay alive
//                                     when only the page content crashes.
//
// Reset behavior — clicking "Coba lagi" re-mounts the children. The full
// catch-all "Muat ulang halaman" button hard-reloads the tab as a last
// resort.

import { Component } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { captureBoundaryError } from '../lib/sentry';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    captureBoundaryError(error, info);
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error, info);
      } catch {
        /* ignore */
      }
    }
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  handleReload() {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (typeof this.props.fallback === 'function') {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleReset,
      });
    }

    const scope = this.props.scope === 'app' ? 'app' : 'route';

    if (scope === 'app') {
      return (
        <div role="alert" className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Terjadi error</h1>
            <p className="mt-2 text-sm text-gray-600">
              Maaf, aplikasi VIPOS mengalami masalah. Tim kami sudah mendapat notifikasi otomatis.
              Coba muat ulang halaman, atau hubungi support kalau masalah tetap muncul.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              <RefreshCw className="h-4 w-4" />
              Muat ulang halaman
            </button>
          </div>
        </div>
      );
    }

    return (
      <div role="alert" className="p-6">
        <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">
                Halaman ini sedang bermasalah
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Bagian halaman gagal dimuat. Tim kami sudah mendapat notifikasi otomatis. Coba lagi,
                atau pindah ke halaman lain dari menu di sebelah kiri.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Coba lagi
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Muat ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
