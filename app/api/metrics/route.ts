import { NextResponse } from 'next/server';
import { getRequestMetrics } from '@/lib/requestLog';

export async function GET() {
  const metrics = getRequestMetrics();
  return NextResponse.json(metrics);
}

