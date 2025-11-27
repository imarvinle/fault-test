import { NextRequest } from 'next/server';

export function sanitizeNamespace(input: string | null | undefined): string {
  if (!input) {
    return 'default';
  }
  return input.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

export function buildKey(namespace: string, key: string) {
  return `${namespace}:${key}`;
}

export function getNamespaceFromRequest(request: NextRequest) {
  const host = request.headers.get('host');
  return sanitizeNamespace(host);
}

