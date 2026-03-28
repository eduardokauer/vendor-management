import axios from 'axios';

export const AUTH_TOKEN_STORAGE_KEY = 'token';
export const VENDOR_STATUSES = ['Compliant', 'Non-Compliant'];

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

export const getStoredToken = () => {
  const storage = getStorage();
  return storage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
};

export const setStoredToken = (token) => {
  const storage = getStorage();

  if (!storage || !token) {
    return;
  }

  storage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

export const clearStoredToken = () => {
  const storage = getStorage();
  storage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

export const loginWithCredentials = async (credentials) => {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const getVendors = async () => {
  const response = await api.get('/api/vendors');
  return response.data;
};

export const getVendorById = async (vendorId) => {
  const response = await api.get(`/api/vendors/${vendorId}`);
  return response.data;
};

export const createVendor = async (payload) => {
  const response = await api.post('/api/vendors', payload);
  return response.data;
};

export const updateVendor = async (vendorId, payload) => {
  const response = await api.put(`/api/vendors/${vendorId}`, payload);
  return response.data;
};

export const deleteVendor = async (vendorId) => {
  await api.delete(`/api/vendors/${vendorId}`);
};

export const getApiErrorMessage = (error, fallbackMessage) => {
  return error.response?.data?.message || fallbackMessage;
};

export default api;
