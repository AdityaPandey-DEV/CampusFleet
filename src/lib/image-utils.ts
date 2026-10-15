/**
 * Utility to convert external photo URLs (Vercel Blob Storage, Google SSO avatars, etc.)
 * into same-origin proxy URLs via `/api/photo-proxy?url=...` so that mobile browsers
 * (Chrome/Samsung Internet/Safari on Android & iOS) will NEVER fail to load them due to
 * Cross-Origin Resource Policy (CORP), Carrier DNS issues, or CORS.
 */
export function getSafePhotoUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // If already a local data URI, blob object URL, or relative path, return directly
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/api/") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  // If it is a remote HTTP/HTTPS URL, route through the same-origin photo proxy
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return `/api/photo-proxy?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
