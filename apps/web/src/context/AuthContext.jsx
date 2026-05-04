// VIPOS — Authentication context.
//
// Talks to /api/auth/* and keeps the access + refresh token in localStorage.
// All HTTP requests go through `utils/api.js` which auto-refreshes 401s.
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../utils/api';

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

  // Self-service tenant signup. Calls POST /api/v1/tenant/register, which
  // creates the tenant + first admin user in a single tx and returns access
  // + refresh tokens. On success we authenticate the new admin immediately
  // (no double-login round-trip), then return the user so the caller can
  // navigate to /onboarding (PR-3) or /dashboard.
  const signupTenant = async ({
    tenant_slug,
    tenant_name,
    admin_username,
    admin_password,
    admin_name,
    admin_email,
    tier = 'lite',
  }) => {
    const res = await api.post('/tenant/register', {
      tenant_slug,
      tenant_name,
      tier,
      admin_username,
      admin_password,
      admin_name,
      admin_email: admin_email || undefined,
    });
    setTokens(res.data);
    setToken(res.data.token);
    setUser(res.data.user);
    return { user: res.data.user, tenant: res.data.tenant };
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, verifyLogin2FA, signupTenant, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
