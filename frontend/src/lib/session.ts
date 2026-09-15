const TOKEN_KEY = 'notewise_token';

export function getLocalToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setLocalToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearLocalToken() {
  localStorage.removeItem(TOKEN_KEY);
}
