import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'token';

export const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const storeAuthToken = (token) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
});

authApi.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let currentUserRequest = null;
let currentUserRequestToken = null;

export const loginRequest = async ({ email, password }) => {
  const response = await authApi.post('/api/auth/login', { email, password });

  storeAuthToken(response.data.token);

  return response.data;
};

export const getCurrentUser = async () => {
  const token = getStoredToken();

  if (!token) {
    throw new Error('No stored token');
  }

  if (currentUserRequest && currentUserRequestToken === token) {
    return currentUserRequest;
  }

  currentUserRequestToken = token;
  currentUserRequest = authApi
    .get('/api/auth/me')
    .then((response) => response.data)
    .finally(() => {
      currentUserRequest = null;
      currentUserRequestToken = null;
    });

  return currentUserRequest;
};
