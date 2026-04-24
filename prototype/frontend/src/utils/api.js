import axios from "axios";

/**
 * Pre-configured axios instance with base URL pointing to the API proxy.
 */
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
