import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { recordRequest } from '@/lib/requestLog';
import { getNamespaceFromRequest } from '@/lib/namespace';

function getPath(request: NextRequest) {
  const search = request.nextUrl.search;
  return `${request.nextUrl.pathname}${search}`;
}

async function applyDelay(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const namespace = getNamespaceFromRequest(request);
  const config = await getConfig(namespace);
  const start = Date.now();

  await applyDelay(config.delay);

  const shouldFail = Math.random() * 100 < config.failureRate;
  if (shouldFail) {
    const response = NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
    await recordRequest(namespace, {
      method: 'GET',
      status: 500,
      success: false,
      latency: Date.now() - start,
      path: getPath(request),
    });
    return response;
  }

  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const response = NextResponse.json({
    message: 'Echo response',
    timestamp: new Date().toISOString(),
    queryParams: params,
    config: {
      delay: config.delay,
      failureRate: config.failureRate,
    },
  });

  await recordRequest(namespace, {
    method: 'GET',
    status: 200,
    success: true,
    latency: Date.now() - start,
    path: getPath(request),
  });

  return response;
}

export async function POST(request: NextRequest) {
  const namespace = getNamespaceFromRequest(request);
  const config = await getConfig(namespace);
  const start = Date.now();

  await applyDelay(config.delay);

  const shouldFail = Math.random() * 100 < config.failureRate;
  if (shouldFail) {
    const response = NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
    await recordRequest(namespace, {
      method: 'POST',
      status: 500,
      success: false,
      latency: Date.now() - start,
      path: getPath(request),
    });
    return response;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const response = NextResponse.json({
    message: 'Echo response',
    timestamp: new Date().toISOString(),
    body: body,
    config: {
      delay: config.delay,
      failureRate: config.failureRate,
    },
  });

  await recordRequest(namespace, {
    method: 'POST',
    status: 200,
    success: true,
    latency: Date.now() - start,
    path: getPath(request),
  });

  return response;
}

