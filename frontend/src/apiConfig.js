// Resolves the backend base URL for API calls.
// - Local dev: empty -> same-origin, Vite dev proxy forwards /api -> 127.0.0.1:8000
// - Production hybrid: set VITE_API_BASE_URL to the external backend (e.g. Render/Railway).
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

// Prefix a server path with the configured backend base URL.
export const apiPath = (p) => `${API_BASE}${p}`;