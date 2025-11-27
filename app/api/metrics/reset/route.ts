import { NextResponse } from 'next/server';
import { resetRequestMetrics } from '@/lib/requestLog';

export async function POST() {
  await resetRequestMetrics();
  return NextResponse.json({ success: true });
}

