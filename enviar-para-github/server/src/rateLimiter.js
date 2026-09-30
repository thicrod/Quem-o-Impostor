// Token bucket simples por socket e por tipo de evento.
// Cada evento consome 1 ficha; as fichas recarregam continuamente.

import { RATE_LIMITS } from './config.js';

export class RateLimiter {
  constructor(limits = RATE_LIMITS, now = () => Date.now()) {
    this.limits = limits;
    this.now = now;
    this.buckets = new Map();
  }

  /** true = pode prosseguir; false = limite excedido. */
  consume(bucketName = 'default') {
    const cfg = this.limits[bucketName] || this.limits.default;
    const t = this.now();
    let bucket = this.buckets.get(bucketName);
    if (!bucket) {
      bucket = { tokens: cfg.capacity, updatedAt: t };
      this.buckets.set(bucketName, bucket);
    }
    const elapsed = (t - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerSec);
    bucket.updatedAt = t;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }
}
