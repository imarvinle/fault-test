'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Config {
  delay: number;
  failureRate: number;
}

interface MetricsStats {
  totalRequests: number;
  lastMinuteRequests: number;
  lastMinuteFailures: number;
  lastMinuteFailureRate: number;
  averageLatencyMs: number;
}

interface RequestLogEntry {
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

interface MetricsPayload {
  stats: MetricsStats;
  recentRequests: RequestLogEntry[];
  series: MetricsSeriesPoint[];
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 140;
const METRICS_REFRESH_INTERVAL = 5000;

export default function Home() {
  const [config, setConfig] = useState<Config>({ delay: 0, failureRate: 0 });
  const [delayInput, setDelayInput] = useState<string>('0');
  const [failureRateInput, setFailureRateInput] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [resettingMetrics, setResettingMetrics] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const response = await fetch('/api/metrics');
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, METRICS_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
      setDelayInput(data.delay.toString());
      setFailureRateInput(data.failureRate.toString());
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setDelayInput(data.delay.toString());
        setFailureRateInput(data.failureRate.toString());
        alert('配置已保存！');
      } else {
        const error = await response.json();
        alert(`保存失败: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const testEcho = async () => {
    setTestResult('测试中...');
    const startTime = Date.now();
    try {
      const response = await fetch('/api/echo?test=1&message=hello');
      const endTime = Date.now();
      const data = await response.json();

      if (response.ok) {
        setTestResult(
          `✅ 成功 (${endTime - startTime}ms)\n${JSON.stringify(data, null, 2)}`
        );
      } else {
        setTestResult(
          `❌ 失败 (${endTime - startTime}ms)\n状态码: ${response.status}\n${JSON.stringify(data, null, 2)}`
        );
      }
    } catch (error) {
      setTestResult(`❌ 请求失败: ${error}`);
    }
  };

  const handleResetMetrics = async () => {
    const confirmed = window.confirm('确认清空当前采样记录与统计数据？');
    if (!confirmed) return;
    setResettingMetrics(true);
    try {
      const response = await fetch('/api/metrics/reset', { method: 'POST' });
      if (!response.ok) {
        throw new Error('重置失败');
      }
      await fetchMetrics();
    } catch (error) {
      console.error('Failed to reset metrics:', error);
      alert('重置失败，请稍后重试');
    } finally {
      setResettingMetrics(false);
    }
  };

  const handleDelayChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setDelayInput(value);
      const numValue = value === '' ? 0 : parseFloat(value);
      if (!isNaN(numValue)) {
        setConfig({ ...config, delay: numValue });
      }
    }
  };

  const handleFailureRateChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFailureRateInput(value);
      const numValue = value === '' ? 0 : parseFloat(value);
      if (!isNaN(numValue)) {
        const clampedValue = Math.min(100, Math.max(0, numValue));
        setConfig({ ...config, failureRate: clampedValue });
      }
    }
  };

  const handleDelayBlur = () => {
    setDelayInput(config.delay.toString());
  };

  const handleFailureRateBlur = () => {
    setFailureRateInput(config.failureRate.toString());
  };

  const heroMetrics = useMemo(
    () => [
      { label: '当前延迟', value: `${config.delay}ms` },
      { label: '配置失败率', value: `${config.failureRate}%` },
      {
        label: '1 分钟请求量',
        value: metrics ? metrics.stats.lastMinuteRequests.toString() : '—',
      },
      {
        label: '1 分钟失败量',
        value: metrics ? metrics.stats.lastMinuteFailures.toString() : '—',
      },
    ],
    [config.delay, config.failureRate, metrics]
  );

  const chartSeries = metrics?.series ?? [];
  const { totalPath, failurePath, yTicks } = useMemo(
    () => buildPaths(chartSeries, CHART_WIDTH, CHART_HEIGHT),
    [chartSeries]
  );

  return (
    <main className="page">
      <div className="page__container">
        <section className="card hero-card">
          <div className="hero-card__content">
            <p className="eyebrow">Fault Injection Playground</p>
            <h1>Echo API 管理面板</h1>
            <p>
              快速调节回声接口的延迟与失败率，模拟真实世界的网络抖动与异常，为压测、
              灾备及回归验证提供更直观的可视化控制。
            </p>

            <div className="hero-card__metrics">
              {heroMetrics.map((item) => (
                <div className="metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="hero-card__actions">
              <button
                className="btn btn--primary"
                onClick={saveConfig}
                disabled={saving || loading}
              >
                {saving ? '保存中...' : '保存配置'}
              </button>
              <button
                className="btn btn--ghost"
                onClick={loadConfig}
                disabled={loading}
              >
                {loading ? '加载中...' : '重新加载'}
              </button>
              <button className="btn btn--success" onClick={testEcho}>
                测试 Echo API
              </button>
            </div>
          </div>
        </section>

        <section className="grid">
          <div className="card form-card">
            <h2>响应策略</h2>
            <p className="helper-text">
              所有设置即时生效，可用于验证客户端在不同延迟和错误概率下的表现。
            </p>

            <div className="field-group">
              <div className="field-group__header">
                <label htmlFor="delay-input">延迟时间（毫秒）</label>
                <span className="field-group__value">实时值：{config.delay}ms</span>
              </div>
              <input
                id="delay-input"
                className="field-input"
                type="text"
                inputMode="numeric"
                value={delayInput}
                onChange={(e) => handleDelayChange(e.target.value)}
                onBlur={handleDelayBlur}
                onFocus={(e) => e.target.select()}
              />
              <p className="helper-text">设置 API 响应延迟，0 表示立即返回。</p>
            </div>

            <div className="field-group">
              <div className="field-group__header">
                <label htmlFor="failure-input">失败率（%）</label>
                <span className="field-group__value">
                  实时值：{config.failureRate}%
                </span>
              </div>
              <input
                id="failure-input"
                className="field-input"
                type="text"
                inputMode="numeric"
                value={failureRateInput}
                onChange={(e) => handleFailureRateChange(e.target.value)}
                onBlur={handleFailureRateBlur}
                onFocus={(e) => e.target.select()}
                maxLength={6}
              />
              <p className="helper-text">
                设置随机返回 500 的概率，支持 0 - 100 之间的小数。
              </p>
            </div>
          </div>

          <div className="card info-card">
            <h2>API 使用说明</h2>
            <ul>
              <li>
                <strong>GET /api/echo</strong> — 回声 GET 请求
              </li>
              <li>
                <strong>POST /api/echo</strong> — 回声 POST 请求
              </li>
              <li>
                <strong>GET /api/config</strong> — 获取当前配置
              </li>
              <li>
                <strong>POST /api/config</strong> — 更新延迟和失败率
              </li>
            </ul>
            <div>
              <p className="helper-text">快速测试</p>
              <pre className="code-block">
{`curl http://localhost:3000/api/echo?test=1&message=hello

curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"delay":1200,"failureRate":18}'`}
              </pre>
            </div>
          </div>
        </section>

        <section className="card metrics-card">
          <div className="metrics-card__header">
            <div>
              <p className="eyebrow">Traffic Monitor</p>
              <h2>最近 10 分钟请求走势</h2>
              {metricsLoading && <span className="metrics-hint">刷新中...</span>}
            </div>
            <button
              className="btn btn--ghost"
              onClick={handleResetMetrics}
              disabled={resettingMetrics}
            >
              {resettingMetrics ? '重置中...' : '重置采样'}
            </button>
          </div>
          <div className="metrics-grid">
            <div className="stat-tile">
              <span>1 分钟请求量</span>
              <strong>{metrics?.stats.lastMinuteRequests ?? '—'}</strong>
            </div>
            <div className="stat-tile">
              <span>1 分钟失败量</span>
              <strong>{metrics?.stats.lastMinuteFailures ?? '—'}</strong>
            </div>
            <div className="stat-tile">
              <span>失败率</span>
              <strong>
                {metrics ? `${metrics.stats.lastMinuteFailureRate.toFixed(1)}%` : '—'}
              </strong>
            </div>
            <div className="stat-tile">
              <span>平均耗时</span>
              <strong>
                {metrics ? `${Math.round(metrics.stats.averageLatencyMs)}ms` : '—'}
              </strong>
            </div>
          </div>

          <div className="traffic-chart">
            <div className="chart__legend">
              <span className="legend-dot legend-dot--total" />
              <span>请求量</span>
              <span className="legend-dot legend-dot--fail" />
              <span>失败量</span>
            </div>
            <div className="chart-container">
              <div className="chart-y-axis">
                {yTicks.map((tick) => (
                  <div
                    key={tick.value}
                    className="chart-y-axis__label"
                    style={{ bottom: `${tick.position}%` }}
                  >
                    <span>{tick.label}</span>
                    <div className="chart-y-axis__line" />
                  </div>
                ))}
              </div>
              <div className="chart-wrapper">
                <svg
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  preserveAspectRatio="none"
                  className="chart"
                >
                  <line
                    className="chart__baseline"
                    x1={0}
                    y1={CHART_HEIGHT - 1}
                    x2={CHART_WIDTH}
                    y2={CHART_HEIGHT - 1}
                  />
                  {totalPath && (
                    <path className="chart__line chart__line--total" d={totalPath} />
                  )}
                  {failurePath && (
                    <path className="chart__line chart__line--fail" d={failurePath} />
                  )}
                </svg>
                <div className="chart-x-axis">
                  {chartSeries.map((point) => (
                    <div key={point.bucketStart}>
                      {new Date(point.bucketStart).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="helper-text">
              采样窗口：最近 5 分钟，按时间切片展示请求与失败数
            </p>
          </div>

          <div className="request-table">
            <div className="request-table__header">
              <h3>最近请求</h3>
              <span>
                {metrics
                  ? `最新 ${metrics.recentRequests.length} 条记录`
                  : '暂无数据'}
              </span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>方法</th>
                    <th>状态</th>
                    <th>耗时</th>
                    <th>路径</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics && metrics.recentRequests.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '16px' }}>
                        暂无请求记录
                      </td>
                    </tr>
                  )}
                  {metrics &&
                    metrics.recentRequests.map((log) => (
                      <tr
                        key={log.id}
                        className={!log.success ? 'table-row--error' : undefined}
                      >
                        <td>
                          <div className="time-cell">
                            <strong>
                              {new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                                hour12: false,
                              })}
                            </strong>
                            <span>{formatRelativeTime(log.timestamp)}</span>
                          </div>
                        </td>
                        <td>
                          <span className="method-pill">{log.method}</span>
                        </td>
                        <td>
                          <span
                            className={`status-chip ${
                              log.success ? 'status-chip--ok' : 'status-chip--fail'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td>{formatLatency(log.latency)}</td>
                        <td className="path-cell">{log.path}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {testResult && (
          <section className="card test-card">
            <div className="test-card__header">
              <h2>测试结果</h2>
              <span className="status-pill">
                {testResult.startsWith('✅')
                  ? '已完成'
                  : testResult.startsWith('测试中')
                  ? '运行中'
                  : '失败'}
              </span>
            </div>
            <pre className="test-card__output">{testResult ?? ''}</pre>
          </section>
        )}
      </div>
    </main>
  );
}

function buildPaths(
  data: MetricsSeriesPoint[],
  width: number,
  height: number
) {
  if (data.length === 0) {
    return {
      totalPath: '',
      failurePath: '',
      yTicks: [] as Array<{ value: number; label: string; position: number }>,
    };
  }

  const maxTotal = Math.max(...data.map((point) => point.total));
  const maxFailures = Math.max(...data.map((point) => point.failures));
  const maxValue = Math.max(maxTotal, maxFailures, 1);
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const createPath = (key: 'total' | 'failures') =>
    data
      .map((point, index) => {
        const x = index * step;
        const scaledY = height - (point[key] / maxValue) * (height - 10);
        const y = Number.isFinite(scaledY) ? scaledY : height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  const roundedMax = Math.ceil(maxValue);
  const tickCount = Math.min(Math.max(roundedMax + 1, 2), 6);
  const tickStep = roundedMax / (tickCount - 1 || 1);

  const denom = Math.max(1, tickStep * (tickCount - 1 || 1));
  const yTicks = Array.from({ length: tickCount }, (_, idx) => {
    const value = Math.round(idx * tickStep);
    return {
      value,
      label: `${value}`,
      position: (value / denom) * 100,
    };
  });

  return {
    totalPath: createPath('total'),
    failurePath: createPath('failures'),
    yTicks,
  };
}

function formatRelativeTime(timestamp: number) {
  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s 前`;
  }
  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}m 前`;
  }
  return `${Math.floor(diffSeconds / 3600)}h 前`;
}

function formatLatency(latency: number) {
  if (latency < 1) {
    return `${latency.toFixed(2)}ms`;
  }
  return `${Math.round(latency)}ms`;
}

