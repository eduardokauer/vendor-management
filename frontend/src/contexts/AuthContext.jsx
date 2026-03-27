import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  clearStoredToken,
  getApiErrorMessage,
  getCurrentUser,
  getStoredToken,
  loginWithCredentials,
  setStoredToken,
} from '../services/api';

const AuthContext = createContext(null);

const normalizeUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    clearStoredToken();
    setUser(null);
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const token = getStoredToken();

      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const authenticatedUser = await getCurrentUser();

        if (isMounted) {
          setUser(normalizeUser(authenticatedUser));
        }
      } catch {
        if (isMounted) {
          clearStoredToken();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { token } = await loginWithCredentials({ email, password });

      if (!token) {
        throw new Error('Authentication token was not returned');
      }

      setStoredToken(token);

      const authenticatedUser = await getCurrentUser();
      const normalizedUser = normalizeUser(authenticatedUser);
      setUser(normalizedUser);

      return normalizedUser;
    } catch (error) {
      clearSession();
      throw new Error(getApiErrorMessage(error, 'Login failed'));
    }
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoading,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
