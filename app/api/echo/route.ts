import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  const config = getConfig();

  // 应用延迟
  if (config.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, config.delay));
  }

  // 根据失败率决定是否返回错误
  const shouldFail = Math.random() * 100 < config.failureRate;
  if (shouldFail) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  // 获取查询参数并返回
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return NextResponse.json({
    message: 'Echo response',
    timestamp: new Date().toISOString(),
    queryParams: params,
    config: {
      delay: config.delay,
      failureRate: config.failureRate,
    },
  });
}

export async function POST(request: NextRequest) {
  const config = getConfig();

  // 应用延迟
  if (config.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, config.delay));
  }

  // 根据失败率决定是否返回错误
  const shouldFail = Math.random() * 100 < config.failureRate;
  if (shouldFail) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  // 获取请求体
  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  return NextResponse.json({
    message: 'Echo response',
    timestamp: new Date().toISOString(),
    body: body,
    config: {
      delay: config.delay,
      failureRate: config.failureRate,
    },
  });
}

