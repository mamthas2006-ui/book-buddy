import { redis, cached, invalidate } from "../config/redis";
import { CACHE_KEYS, CACHE_TTL } from "../constants";

export { cached };

export const CacheService = {
  async getUserProfile<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    return cached(CACHE_KEYS.USER_PROFILE(userId), CACHE_TTL.MEDIUM, fn);
  },

  async invalidateUserProfile(userId: string): Promise<void> {
    await redis.del(CACHE_KEYS.USER_PROFILE(userId));
  },

  async invalidateAdminStats(): Promise<void> {
    await redis.del(CACHE_KEYS.ADMIN_STATS);
  },

  async invalidateBooksList(): Promise<void> {
    await invalidate("books:list:");
    await redis.del(CACHE_KEYS.BOOKS_TRENDING);
  }
};
