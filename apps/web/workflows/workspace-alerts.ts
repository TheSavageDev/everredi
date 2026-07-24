import { callInternalApi } from '@/lib/internal-api';

async function listWorkspaceIds() {
  'use step';
  const data = await callInternalApi<{ workspaceIds: string[] }>(
    '/internal/alerts/workspaces',
  );
  return data.workspaceIds;
}

async function processWorkspace(workspaceId: string) {
  'use step';
  return callInternalApi<{
    workspaceId: string;
    expiring: number;
    lowStock: number;
    notifiedUsers: number;
  }>(`/internal/alerts/workspaces/${workspaceId}`, { method: 'POST' });
}

/** Durable fan-out of expiration / low-stock notifications. */
export async function workspaceAlertsWorkflow() {
  'use workflow';

  const workspaceIds = await listWorkspaceIds();
  const results = [];
  for (const workspaceId of workspaceIds) {
    results.push(await processWorkspace(workspaceId));
  }
  return {
    workspaces: results.length,
    notifiedUsers: results.reduce((sum, r) => sum + r.notifiedUsers, 0),
    results,
  };
}
