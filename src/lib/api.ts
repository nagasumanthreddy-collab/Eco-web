import { offlineExportCsv, offlineRequest } from './offlineEngine.ts';

const TOKEN_STORAGE_KEY = 'ecopredict_session_token';

export function isOfflineBundle(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'file:' ||
    import.meta.env.VITE_OFFLINE_BUNDLE === 'true'
  );
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (isOfflineBundle()) {
    return offlineRequest<T>(path, options);
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login') {
      setStoredToken(null);
    }
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // keep default error text
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export async function apiDownloadCsv(path: string, filename: string): Promise<void> {
  let blob: Blob;
  if (isOfflineBundle()) {
    const csvText = offlineExportCsv(path);
    blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  } else {
    const headers = new Headers();
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(path, {
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiError('Failed to export CSV', response.status);
    }
    blob = await response.blob();
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
