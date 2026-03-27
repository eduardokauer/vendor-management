import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  clearAuthToken,
  getCurrentUser,
  getStoredToken,
  loginRequest,
} from '../services/authService';

const AuthContext = createContext(null);

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.message || fallbackMessage;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(getStoredToken()));

  useEffect(() => {
    let isActive = true;

    const bootstrapSession = async () => {
      const storedToken = getStoredToken();

      if (!storedToken) {
        if (isActive) {
          setUser(null);
          setIsLoading(false);
        }

        return;
      }

      try {
        const currentUser = await getCurrentUser();

        if (isActive) {
          setUser(currentUser);
        }
      } catch {
        clearAuthToken();

        if (isActive) {
          setUser(null);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      isActive = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      await loginRequest({ email, password });
      const currentUser = await getCurrentUser();

      setUser(currentUser);

      return currentUser;
    } catch (error) {
      clearAuthToken();
      setUser(null);
      throw new Error(getErrorMessage(error, 'Login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setIsLoading(false);
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
