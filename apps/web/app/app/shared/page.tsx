'use client';

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api';

export default function SharedPage() {
  const shared = useQuery({
    queryKey: ['shared-kits'],
    queryFn: () => getApi().sharing.sharedWithMe(),
  });

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Shared with me</h1>
      <ul className="mt-6 space-y-2">
        {(shared.data ?? []).map((kit) => (
          <li key={kit.id} className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3">
            {kit.name}
          </li>
        ))}
        {(shared.data ?? []).length === 0 ? (
          <li className="text-sm text-ink/60">No shared kits yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
