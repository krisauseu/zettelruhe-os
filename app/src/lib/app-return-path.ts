/** Form-selected return locations remain inside the current instance's app. */
export function appReturnPath(value: string, fallback: string): string {
  if (!value.startsWith("/app") || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://instance.invalid");
    if (url.origin !== "https://instance.invalid" || !/^\/app(?:\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}
