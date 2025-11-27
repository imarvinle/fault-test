import { redis } from '@/lib/redis';
import { buildKey } from '@/lib/namespace';

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
const BUCKET_DURATION_MS = 60 * 1000; // 1 minute
const SERIES_BUCKETS = 10; // 最近 10 分钟
const BUCKET_TTL_MS = BUCKET_DURATION_MS * (SERIES_BUCKETS + 5);
const BUCKET_PREFIX = 'metrics:bucket:';
const RECENT_LOGS_SUFFIX = 'metrics:recent_logs';
const TOTAL_REQUESTS_SUFFIX = 'metrics:total_requests';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function getBucketTimestamp(timestamp: number) {
  return timestamp - (timestamp % BUCKET_DURATION_MS);
}

function formatBucketId(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}${month}${day}${hour}${minute}`;
}

function getBucketInfo(timestamp: number) {
  const bucketTimestamp = getBucketTimestamp(timestamp);
  return {
    id: formatBucketId(bucketTimestamp),
    timestamp: bucketTimestamp,
  };
}

function buildRecentBucketDescriptors(now: number) {
  return Array.from({ length: SERIES_BUCKETS }, (_, idx) => {
    const bucketTimestamp =
      getBucketTimestamp(now) - (SERIES_BUCKETS - 1 - idx) * BUCKET_DURATION_MS;
    return {
      id: formatBucketId(bucketTimestamp),
      timestamp: bucketTimestamp,
    };
  });
}

function getRecentLogsKey(namespace: string) {
  return buildKey(namespace, RECENT_LOGS_SUFFIX);
}

function getTotalRequestsKey(namespace: string) {
  return buildKey(namespace, TOTAL_REQUESTS_SUFFIX);
}

function getBucketKey(namespace: string, bucketId: string) {
  return buildKey(namespace, `${BUCKET_PREFIX}${bucketId}`);
}

export async function recordRequest(
  namespace: string,
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

  const bucketInfo = getBucketInfo(timestamp);
  const bucketKey = getBucketKey(namespace, bucketInfo.id);
  const recentLogsKey = getRecentLogsKey(namespace);
  const totalKey = getTotalRequestsKey(namespace);

  const multi = redis
    .multi()
    .lpush(recentLogsKey, JSON.stringify(entry))
    .ltrim(recentLogsKey, 0, MAX_LOGS - 1)
    .incr(totalKey)
    .hincrby(bucketKey, 'total', 1)
    .pexpire(bucketKey, BUCKET_TTL_MS);

  if (!entry.success) {
    multi.hincrby(bucketKey, 'failures', 1);
  }

  await multi.exec();
}

export async function getRequestMetrics(
  namespace: string,
  limit = 50
): Promise<RequestMetricsPayload> {
  const now = Date.now();
  const lastMinuteThreshold = now - 60_000;
  const oldestBucketTimestamp =
    getBucketTimestamp(now) - (SERIES_BUCKETS - 1) * BUCKET_DURATION_MS;

  const logsToFetch = Math.max(limit, 500);
  const rawLogs = await redis.lrange(getRecentLogsKey(namespace), 0, logsToFetch - 1);
  console.log('[metrics] rawLogs count:', rawLogs.length);
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

  const bucketDescriptors = buildRecentBucketDescriptors(now);

  const bucketPromises = bucketDescriptors.map(async (descriptor) => {
    const bucketKey = getBucketKey(namespace, descriptor.id);
    const result = (await redis.hmget(bucketKey, 'total', 'failures')) as
      | Record<string, string | null>
      | null;
    const totalRaw = result?.total ?? null;
    const failuresRaw = result?.failures ?? null;
    console.log('[metrics] bucket', bucketKey, 'raw values', result);
    return {
      bucketStart: descriptor.timestamp,
      total: Number(totalRaw ?? 0),
      failures: Number(failuresRaw ?? 0),
    };
  });

  let series = await Promise.all(bucketPromises);
  const hasBucketData = series.some((bucket) => bucket.total > 0 || bucket.failures > 0);

  if (!hasBucketData) {
    console.log('[metrics] no bucket data found, rebuilding from logs');
    const bucketMap = new Map(
      bucketDescriptors.map((descriptor) => [
        formatBucketId(descriptor.timestamp),
        { bucketStart: descriptor.timestamp, total: 0, failures: 0 },
      ])
    );

    for (const log of parsedLogs) {
      if (log.timestamp >= oldestBucketTimestamp) {
        const bucket = bucketMap.get(formatBucketId(getBucketTimestamp(log.timestamp)));
        if (bucket) {
          bucket.total += 1;
          if (!log.success) {
            bucket.failures += 1;
          }
        }
      }
    }

    series = Array.from(bucketMap.values());
  }
  const totalRequests = Number((await redis.get(getTotalRequestsKey(namespace))) ?? 0);
  console.log('[metrics] stats snapshot', {
    totalRequests,
    lastMinuteRequests,
    lastMinuteFailures,
    buckets: series.map((b) => ({ ...b })),
  });

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

export async function resetRequestMetrics(namespace: string) {
  await redis.del(getRecentLogsKey(namespace), getTotalRequestsKey(namespace));

  let cursor = 0;
  const match = buildKey(namespace, `${BUCKET_PREFIX}*`);

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match, count: 100 });
    cursor = Number(nextCursor);
    if (keys.length) {
      await redis.del(...keys);
    }
  } while (cursor !== 0);
}

