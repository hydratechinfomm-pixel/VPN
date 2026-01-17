// Frontend context for authentication
import React, { createContext, useState, useCallback, useEffect } from 'react';
import { authAPI } from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = useCallback(async (email, password) => {
    const response = await authAPI.login(email, password);
    localStorage.setItem('token', response.token);
    localStorage.setItem('refreshToken', response.refreshToken);
    setToken(response.token);
    setUser(response.user);
    return response;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await authAPI.register(userData);
    localStorage.setItem('token', response.token);
    localStorage.setItem('refreshToken', response.refreshToken);
    setToken(response.token);
    setUser(response.user);
    return response;
  }, []);

  const logout = useCallback(async () => {
    await authAPI.logout();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    const updatedUser = await authAPI.updateProfile(profileData);
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
