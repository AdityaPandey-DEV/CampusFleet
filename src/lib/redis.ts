import { Redis } from "@upstash/redis";

// Check for Vercel KV / Upstash Redis environment variables
const redisUrl =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_URL;

const redisToken =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_TOKEN;

/**
 * Singleton Redis client instance (Upstash / Vercel KV compatible).
 * Gracefully returns null when credentials are not configured yet,
 * enabling zero-crash local development and seamless cloud activation.
 */
export const redis: Redis | null =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  USER_ROLE: 300, // 5 minutes
  USER_SESSION: 600, // 10 minutes
  OTP: 300, // 5 minutes
  FLEET_STATS: 60, // 1 minute
  HOT_DATA_ROUTES: 3600, // 1 hour (rarely changes)
  HOT_DATA_STOPS: 3600, // 1 hour
  HOT_DATA_SHIFTS: 3600, // 1 hour
  HOT_DATA_TRIPS: 60, // 1 minute (changes often with active trips)
} as const;

/**
 * Get a cached JSON or primitive value from Redis.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<T>(key);
    return data ?? null;
  } catch (err) {
    console.warn(`[Redis] cacheGet error for key "${key}":`, err);
    return null;
  }
}

/**
 * Set a value in Redis with optional TTL in seconds.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<boolean> {
  if (!redis) return false;
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn(`[Redis] cacheSet error for key "${key}":`, err);
    return false;
  }
}

/**
 * Delete one or more keys from Redis.
 */
export async function cacheDel(key: string): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.warn(`[Redis] cacheDel error for key "${key}":`, err);
    return false;
  }
}

// ── User Role & Session Caching Helpers ─────────────────────────────────────

export function getUserRoleKey(userId: string): string {
  return `user:role:${userId}`;
}

export async function getCachedUserRole(userId: string): Promise<string | null> {
  return cacheGet<string>(getUserRoleKey(userId));
}

export async function setCachedUserRole(userId: string, role: string): Promise<void> {
  await cacheSet(getUserRoleKey(userId), role, CACHE_TTL.USER_ROLE);
}

export async function invalidateCachedUserRole(userId: string): Promise<void> {
  await cacheDel(getUserRoleKey(userId));
}
