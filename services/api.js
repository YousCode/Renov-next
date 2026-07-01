import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  withCredentials: true,
});

API.interceptors.response.use(
  response => response,
  error => {
    const { response } = error;
    if (response) {
      return Promise.reject(response);
    }
    return Promise.reject(error);
  }
);

export default API;
