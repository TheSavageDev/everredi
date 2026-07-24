import { send } from '@vercel/queue';
import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { getFlags } from '@/lib/flags';
import { callInternalApi } from '@/lib/internal-api';
import { workspaceAlertsWorkflow } from '@/workflows/workspace-alerts';

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

/**
 * Vercel Cron entrypoint.
 *
 * Dispatch modes (Edge Config `alertsDispatch` or `?dispatch=`):
 * - sync (default): Nest scans all workspaces inline
 * - queue: enqueue one message per workspace
 * - workflow: durable Workflow SDK fan-out
 */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const flags = await getFlags();
  const dispatch =
    (request.nextUrl.searchParams.get('dispatch') as
      | 'sync'
      | 'queue'
      | 'workflow'
      | null) ?? flags.alertsDispatch;

  if (dispatch === 'workflow') {
    const run = await start(workspaceAlertsWorkflow);
    return NextResponse.json({ success: true, dispatch, runId: run.runId });
  }

  if (dispatch === 'queue') {
    const data = await callInternalApi<{ workspaceIds: string[] }>(
      '/internal/alerts/workspaces',
    );
    const messageIds: string[] = [];
    for (const workspaceId of data.workspaceIds) {
      const { messageId } = await send('workspace-alerts', { workspaceId });
      if (messageId) messageIds.push(messageId);
    }
    return NextResponse.json({
      success: true,
      dispatch,
      enqueued: messageIds.length,
      messageIds,
    });
  }

  const result = await callInternalApi('/internal/cron/alerts');
  return NextResponse.json({ success: true, dispatch: 'sync', data: result });
}
