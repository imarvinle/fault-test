import { NextRequest, NextResponse } from 'next/server';
import { resetRequestMetrics } from '@/lib/requestLog';
import { getNamespaceFromRequest } from '@/lib/namespace';

export async function POST(request: NextRequest) {
  const namespace = getNamespaceFromRequest(request);
  await resetRequestMetrics(namespace);
  return NextResponse.json({ success: true });
}

