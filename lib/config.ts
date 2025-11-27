// 配置存储（内存存储）
export interface EchoConfig {
  delay: number; // 延迟时间（毫秒）
  failureRate: number; // 失败率（0-100）
}

let config: EchoConfig = {
  delay: 0,
  failureRate: 0,
};

export function getConfig(): EchoConfig {
  return { ...config };
}

export function updateConfig(newConfig: Partial<EchoConfig>): EchoConfig {
  config = { ...config, ...newConfig };
  return { ...config };
}

