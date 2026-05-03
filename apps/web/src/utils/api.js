// VIPOS — Axios client with automatic refresh-token rotation.
//
// Behavior:
//   - Request interceptor injects `Authorization: Bearer <access>`.
//   - 401 responses trigger a single refresh attempt; if successful, all
//     queued requests are replayed with the new access token.
//   - If refresh fails or no refresh token is stored, the user is redirected
//     to `/login`.
//
// Tokens live in localStorage:
//   vipos_token         → access JWT (15 min lifetime)
//   vipos_refresh_token → opaque refresh token (7–30 day lifetime)
import axios from 'axios';

const ACCESS_KEY = 'vipos_token';
const REFRESH_KEY = 'vipos_refresh_token';

const baseURL = `${import.meta.env.BASE_URL}api`;

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ token, refresh_token } = {}) {
  if (token) localStorage.setItem(ACCESS_KEY, token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshInFlight = null;

async function refreshTokens() {
  if (refreshInFlight) return refreshInFlight;
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error('no_refresh_token');
  refreshInFlight = axios
    .post(`${baseURL}/auth/refresh`, { refresh_token }, {
      headers: { 'Content-Type': 'application/json' },
    })
    .then((res) => {
      setTokens(res.data);
      return res.data.token;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function redirectToLogin() {
  clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');
    if (status === 401 && !original?._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        await refreshTokens();
        return api(original);
      } catch {
        redirectToLogin();
      }
    } else if (status === 401 || status === 403) {
      // No refresh possible (or also 403 on legitimate forbidden routes).
      if (!isAuthEndpoint) redirectToLogin();
    }
    return Promise.reject(error);
  },
);

export default api;
