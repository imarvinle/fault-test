import { NextResponse } from 'next/server';
import { getRequestMetrics } from '@/lib/requestLog';

export async function GET() {
  const metrics = await getRequestMetrics();
  return NextResponse.json(metrics);
}

