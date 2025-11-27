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

const logs: RequestLogEntry[] = [];
let totalRequests = 0;
let nextId = 1;

export function recordRequest(
  data: Omit<RequestLogEntry, 'id' | 'timestamp'> & { timestamp?: number }
) {
  const entry: RequestLogEntry = {
    id: nextId++,
    timestamp: data.timestamp ?? Date.now(),
    method: data.method,
    status: data.status,
    success: data.success,
    latency: data.latency,
    path: data.path,
  };

  logs.push(entry);
  totalRequests += 1;

  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export function getRequestMetrics(limit = 50): RequestMetricsPayload {
  const now = Date.now();
  const lastMinuteThreshold = now - 60_000;
  const fiveMinuteThreshold = now - FIVE_MINUTES_MS;

  let lastMinuteRequests = 0;
  let lastMinuteFailures = 0;
  let latencySum = 0;

  for (const log of logs) {
    if (log.timestamp >= lastMinuteThreshold) {
      lastMinuteRequests += 1;
      latencySum += log.latency;

      if (!log.success) {
        lastMinuteFailures += 1;
      }
    }
  }

  const bucketSize = Math.max(1, Math.floor(FIVE_MINUTES_MS / SERIES_BUCKETS));
  const series: MetricsSeriesPoint[] = Array.from({ length: SERIES_BUCKETS }, (_, idx) => {
    const bucketStart = fiveMinuteThreshold + idx * bucketSize;
    return {
      bucketStart,
      total: 0,
      failures: 0,
    };
  });

  for (const log of logs) {
    if (log.timestamp >= fiveMinuteThreshold) {
      const bucketIndex = Math.min(
        SERIES_BUCKETS - 1,
        Math.floor((log.timestamp - fiveMinuteThreshold) / bucketSize)
      );
      const bucket = series[bucketIndex];
      bucket.total += 1;
      if (!log.success) {
        bucket.failures += 1;
      }
    }
  }

  const stats: MetricsStats = {
    totalRequests,
    lastMinuteRequests,
    lastMinuteFailures,
    lastMinuteFailureRate:
      lastMinuteRequests === 0 ? 0 : (lastMinuteFailures / lastMinuteRequests) * 100,
    averageLatencyMs:
      lastMinuteRequests === 0 ? 0 : parseFloat((latencySum / lastMinuteRequests).toFixed(2)),
  };

  const recentRequests = logs.slice(-limit).reverse();

  return {
    stats,
    recentRequests,
    series,
  };
}

export function resetRequestMetrics() {
  logs.length = 0;
  totalRequests = 0;
  nextId = 1;
}

