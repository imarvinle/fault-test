import { redis } from '@/lib/redis';
import { buildKey } from '@/lib/namespace';

export interface EchoConfig {
  delay: number;
  failureRate: number;
}

const DEFAULT_CONFIG: EchoConfig = {
  delay: 0,
  failureRate: 0,
};

export async function getConfig(namespace: string): Promise<EchoConfig> {
  const key = buildKey(namespace, 'metrics:config');
  const result = await redis.hgetall<Record<string, string>>(key);
  if (!result || Object.keys(result).length === 0) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    delay: Number(result.delay ?? DEFAULT_CONFIG.delay),
    failureRate: Number(result.failureRate ?? DEFAULT_CONFIG.failureRate),
  };
}

export async function updateConfig(
  namespace: string,
  newConfig: Partial<EchoConfig>
): Promise<EchoConfig> {
  const current = await getConfig(namespace);
  const merged: EchoConfig = {
    delay: newConfig.delay ?? current.delay,
    failureRate: newConfig.failureRate ?? current.failureRate,
  };

  const key = buildKey(namespace, 'metrics:config');
  await redis.hmset(key, {
    delay: merged.delay.toString(),
    failureRate: merged.failureRate.toString(),
  });

  return merged;
}

