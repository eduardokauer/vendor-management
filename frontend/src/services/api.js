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

export const getVendorDocuments = async (vendorId) => {
  const response = await api.get(`/api/vendors/${vendorId}/documents`);
  return response.data;
};

export const uploadVendorDocument = async (vendorId, payload) => {
  const formData = new FormData();

  formData.append('type', payload.type);

  if (payload.expires_at) {
    formData.append('expires_at', payload.expires_at);
  }

  formData.append('file', payload.file);

  const response = await api.post(`/api/documents/upload/${vendorId}`, formData);
  return response.data;
};

export const checkVendorCompliance = async (vendorId) => {
  const response = await api.post(`/api/vendors/${vendorId}/check-compliance`);
  return response.data;
};

const getFilenameFromDisposition = (contentDisposition = '') => {
  const match = /filename=\"?([^\";]+)\"?/.exec(contentDisposition);
  return match?.[1] ?? 'document';
};

export const downloadDocumentFile = async (documentId) => {
  const response = await api.get(`/api/documents/${documentId}/download`, {
    responseType: 'blob',
  });

  return {
    blob: response.data,
    filename: getFilenameFromDisposition(response.headers['content-disposition']),
  };
};

export const getApiErrorMessage = (error, fallbackMessage) => {
  return error.response?.data?.message || fallbackMessage;
};

export default api;
