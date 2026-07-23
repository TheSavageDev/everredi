'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function TemplatesPage() {
  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => getApi().kits.templates(),
  });
  const create = useMutation({
    mutationFn: (templateId: string) =>
      getApi().kits.createFromTemplate(workspaceId!, { templateId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kits', workspaceId] }),
  });

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Templates</h1>
      <ul className="mt-6 space-y-3">
        {(templates.data ?? []).map((t) => (
          <li key={t.id} className="rounded-xl border border-ink/10 bg-white/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-ink/60">{t.description}</p>
                <p className="mt-1 text-xs text-ink/50">{t.items.length} items</p>
              </div>
              <button
                type="button"
                disabled={!workspaceId || create.isPending}
                onClick={() => create.mutate(t.id)}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white"
              >
                Use template
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
