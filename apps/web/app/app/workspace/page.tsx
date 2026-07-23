'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function WorkspacePage() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => getApi().workspaces.list(),
  });
  const members = useQuery({
    queryKey: ['members', workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => getApi().workspaces.members(workspace!.id),
  });
  const invites = useQuery({
    queryKey: ['invites', workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => getApi().workspaces.listInvites(workspace!.id),
  });

  const invite = useMutation({
    mutationFn: () =>
      getApi().workspaces.invite(workspace!.id, { email, role: 'member' }),
    onSuccess: () => {
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['invites', workspace?.id] });
    },
  });

  const accept = useMutation({
    mutationFn: () => getApi().workspaces.acceptInvite(token),
    onSuccess: () => {
      setToken('');
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  return (
    <main className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-semibold">Workspace</h1>
        <p className="mt-2 text-sm text-ink/70">Invite many members and switch workspaces.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(workspaces.data ?? []).map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => setWorkspace(ws)}
              className={`rounded-full px-3 py-1 text-sm ${
                workspace?.id === ws.id ? 'bg-accent text-white' : 'bg-white border border-ink/10'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-3 space-y-2">
          {(members.data ?? []).map((m) => (
            <li key={m.id} className="rounded-lg bg-white/80 px-3 py-2 text-sm">
              {m.displayName || m.email || m.userId} · {m.role}
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate();
          }}
        >
          <input
            className="flex-1 rounded-md border border-ink/15 bg-white px-3 py-2"
            placeholder="Invite by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
            Invite
          </button>
        </form>
        <ul className="mt-3 space-y-1 text-xs text-ink/60">
          {(invites.data ?? [])
            .filter((i) => i.status === 'pending')
            .map((i) => (
              <li key={i.id}>
                Pending: {i.email} · token {i.token.slice(0, 8)}…
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">Accept invite</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) accept.mutate();
          }}
        >
          <input
            className="flex-1 rounded-md border border-ink/15 bg-white px-3 py-2"
            placeholder="Invite token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="rounded-md border border-ink/20 bg-white px-4 py-2 text-sm" type="submit">
            Accept
          </button>
        </form>
      </section>
    </main>
  );
}
