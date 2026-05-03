// VIPOS — Authentication context.
//
// Talks to /api/auth/* and keeps the access + refresh token in localStorage.
// All HTTP requests go through `utils/api.js` which auto-refreshes 401s.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getAccessToken());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await api.post('/auth/logout', { refresh_token: refresh });
      } catch {
        /* best effort — server may be down */
      }
    }
    clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token) {
      api
        .get('/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => {
          clearTokens();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Step 1 of login. Returns either { user } when 2FA is disabled, or
  // { requires_2fa, login_token } when the server demands a TOTP code.
  const login = async (username, password, { rememberMe = false } = {}) => {
    const res = await api.post('/auth/login', {
      username,
      password,
      remember_me: rememberMe,
    });
    if (res.data.requires_2fa) {
      return { requires_2fa: true, login_token: res.data.login_token };
    }
    setTokens(res.data);
    setToken(res.data.token);
    setUser(res.data.user);
    return { user: res.data.user };
  };

  // Step 2 of login (only needed when requires_2fa was returned in step 1).
  const verifyLogin2FA = async (login_token, code, { rememberMe = false } = {}) => {
    const res = await api.post('/auth/login/2fa', {
      login_token,
      code,
      remember_me: rememberMe,
    });
    setTokens(res.data);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, verifyLogin2FA, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
