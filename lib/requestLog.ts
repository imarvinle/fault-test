import { redis } from '@/lib/redis';

export interface RequestLogEntry {
  id: number;
  method: string;
  status: number;
  success: boolean;
  latency: number;
  timestamp: number;
  path: string;
}

interface MetricsSeriesPoint {
  bucketStart: number;
  total: number;
  failures: number;
}

interface MetricsStats {
  totalRequests: number;
  lastMinuteRequests: number;
  lastMinuteFailures: number;
  lastMinuteFailureRate: number;
  averageLatencyMs: number;
}

export interface RequestMetricsPayload {
  stats: MetricsStats;
  recentRequests: RequestLogEntry[];
  series: MetricsSeriesPoint[];
}

const MAX_LOGS = 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SERIES_BUCKETS = 20;
const BUCKET_TTL_MS = FIVE_MINUTES_MS * 2;
const BUCKET_PREFIX = 'metrics:bucket:';
const RECENT_LOGS_KEY = 'metrics:recent_logs';
const TOTAL_REQUESTS_KEY = 'metrics:total_requests';

const bucketSize = Math.max(1, Math.floor(FIVE_MINUTES_MS / SERIES_BUCKETS));

function getBucketStart(timestamp: number) {
  return Math.floor(timestamp / bucketSize) * bucketSize;
}

export async function recordRequest(
  data: Omit<RequestLogEntry, 'id' | 'timestamp'> & { timestamp?: number }
) {
  const timestamp = data.timestamp ?? Date.now();
  const uniqueId = Number(`${timestamp}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`);
  const entry: RequestLogEntry = {
    ...data,
    id: uniqueId,
    timestamp,
  };

  const bucketStart = getBucketStart(timestamp);
  const bucketKey = `${BUCKET_PREFIX}${bucketStart}`;

  const multi = redis
    .multi()
    .lpush(RECENT_LOGS_KEY, JSON.stringify(entry))
    .ltrim(RECENT_LOGS_KEY, 0, MAX_LOGS - 1)
    .incr(TOTAL_REQUESTS_KEY)
    .hincrby(bucketKey, 'total', 1)
    .pexpire(bucketKey, BUCKET_TTL_MS);

  if (!entry.success) {
    multi.hincrby(bucketKey, 'failures', 1);
  }

  await multi.exec();
}

export async function getRequestMetrics(limit = 50): Promise<RequestMetricsPayload> {
  const now = Date.now();
  const lastMinuteThreshold = now - 60_000;
  const fiveMinuteThreshold = now - FIVE_MINUTES_MS;

  const logsToFetch = Math.max(limit, 500);
  const rawLogs = await redis.lrange(RECENT_LOGS_KEY, 0, logsToFetch - 1);
  const parsedLogs: RequestLogEntry[] = rawLogs
    .map((item: string) => {
      try {
        return JSON.parse(item) as RequestLogEntry;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RequestLogEntry[];

  let lastMinuteRequests = 0;
  let lastMinuteFailures = 0;
  let latencySum = 0;

  for (const log of parsedLogs) {
    if (log.timestamp >= lastMinuteThreshold) {
      lastMinuteRequests += 1;
      latencySum += log.latency;
      if (!log.success) {
        lastMinuteFailures += 1;
      }
    }
  }

  const bucketPromises = Array.from({ length: SERIES_BUCKETS }, (_, idx) => {
    const bucketStart = fiveMinuteThreshold + idx * bucketSize;
    const bucketKey = `${BUCKET_PREFIX}${bucketStart}`;
    return redis
      .hmget<[string | null, string | null]>(bucketKey, 'total', 'failures')
      .then((result: [string | null, string | null] | null) => ({
        bucketStart,
        total: Number(result?.[0] ?? 0),
        failures: Number(result?.[1] ?? 0),
      }));
  });

  const series = await Promise.all(bucketPromises);
  const totalRequests = Number((await redis.get(TOTAL_REQUESTS_KEY)) ?? 0);

  const stats: MetricsStats = {
    totalRequests,
    lastMinuteRequests,
    lastMinuteFailures,
    lastMinuteFailureRate:
      lastMinuteRequests === 0 ? 0 : (lastMinuteFailures / lastMinuteRequests) * 100,
    averageLatencyMs:
      lastMinuteRequests === 0 ? 0 : parseFloat((latencySum / lastMinuteRequests).toFixed(2)),
  };

  const recentRequests = parsedLogs.slice(0, limit);

  return {
    stats,
    recentRequests,
    series,
  };
}

export async function resetRequestMetrics() {
  await redis.del(RECENT_LOGS_KEY, TOTAL_REQUESTS_KEY);

  const keysToDelete: string[] = [];
  for await (const key of redis.scanIterator({ match: `${BUCKET_PREFIX}*`, count: 100 })) {
    if (typeof key === 'string') {
      keysToDelete.push(key);
      if (keysToDelete.length >= 50) {
        await redis.del(...keysToDelete);
        keysToDelete.length = 0;
      }
    }
  }

  if (keysToDelete.length) {
    await redis.del(...keysToDelete);
  }
}

