import { NextRequest, NextResponse } from 'next/server';
import { getRequestMetrics } from '@/lib/requestLog';
import { getNamespaceFromRequest } from '@/lib/namespace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const namespace = getNamespaceFromRequest(request);
  const metrics = await getRequestMetrics(namespace);
  return NextResponse.json(metrics);
}

