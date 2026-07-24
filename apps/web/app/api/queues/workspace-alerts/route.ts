import { handleCallback } from '@vercel/queue';
import type { NextRequest } from 'next/server';
import { callInternalApi } from '@/lib/internal-api';

type WorkspaceAlertMessage = {
  workspaceId: string;
  withinDays?: number;
};

const consume = handleCallback(async (message: WorkspaceAlertMessage) => {
  if (!message?.workspaceId) {
    throw new Error('workspaceId is required');
  }
  const qs =
    message.withinDays != null ? `?withinDays=${message.withinDays}` : '';
  await callInternalApi(`/internal/alerts/workspaces/${message.workspaceId}${qs}`, {
    method: 'POST',
  });
});

export async function POST(request: NextRequest) {
  return consume(request);
}
