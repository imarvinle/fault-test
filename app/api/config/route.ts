import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/lib/config';
import { getNamespaceFromRequest } from '@/lib/namespace';

export async function GET(request: NextRequest) {
  const namespace = getNamespaceFromRequest(request);
  const config = await getConfig(namespace);
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { delay, failureRate } = body;

    // 验证输入
    if (delay !== undefined && (typeof delay !== 'number' || delay < 0)) {
      return NextResponse.json(
        { error: 'Delay must be a non-negative number' },
        { status: 400 }
      );
    }

    if (failureRate !== undefined && (typeof failureRate !== 'number' || failureRate < 0 || failureRate > 100)) {
      return NextResponse.json(
        { error: 'Failure rate must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    const namespace = getNamespaceFromRequest(request);
    const updatedConfig = await updateConfig(namespace, { delay, failureRate });
    return NextResponse.json(updatedConfig);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

