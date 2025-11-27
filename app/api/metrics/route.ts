import { NextResponse } from 'next/server';
import { getRequestMetrics } from '@/lib/requestLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const metrics = await getRequestMetrics();
  return NextResponse.json(metrics);
}

