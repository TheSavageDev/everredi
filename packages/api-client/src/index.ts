import type {
  ApiResponse,
  InventoryItem,
  Kit,
  KitAclEntry,
  KitTemplate,
  Location,
  Notification,
  ShareLink,
  Supply,
  SupplyCategory,
  User,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from '@everredi/types';
import type {
  CreateFromTemplateInput,
  CreateInventoryItemInput,
  CreateKitInput,
  CreateLocationInput,
  CreateShareLinkInput,
  CreateWorkspaceInput,
  InviteMemberInput,
  ShareKitWithUserInput,
  UpdateInventoryItemInput,
  UpdateKitInput,
  UpdateLocationInput,
  UpsertUserInput,
} from '@everredi/validation';

export type GetAccessToken = () => Promise<string | null> | string | null;

export interface EverrediClientOptions {
  baseUrl: string;
  getAccessToken: GetAccessToken;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text();
  if (!text) {
    return {
      success: false,
      message: res.statusText || 'Empty response',
      timestamp: new Date().toISOString(),
    };
  }
  return JSON.parse(text) as ApiResponse<T>;
}

export function createEverrediClient(options: EverrediClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await options.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
    const payload = await parseJson<T>(res);

    if (!res.ok || !payload.success) {
      throw new ApiError(
        !payload.success ? payload.message : res.statusText,
        res.status,
        payload,
      );
    }
    return payload.data;
  }

  const get = <T>(path: string) => request<T>(path);
  const post = <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const put = <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const patch = <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

  return {
    auth: {
      createOrUpdate: (input?: UpsertUserInput) =>
        post<{ user: User; workspace: Workspace }>('/auth/create-or-update', input ?? {}),
    },
    users: {
      me: () => get<User>('/users/me'),
      updateMe: (input: UpsertUserInput) => put<User>('/users/me', input),
    },
    workspaces: {
      list: () => get<Workspace[]>('/workspaces'),
      create: (input: CreateWorkspaceInput) => post<Workspace>('/workspaces', input),
      members: (workspaceId: string) =>
        get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
      invite: (workspaceId: string, input: InviteMemberInput) =>
        post<WorkspaceInvite>(`/workspaces/${workspaceId}/invites`, input),
      listInvites: (workspaceId: string) =>
        get<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`),
      acceptInvite: (token: string) =>
        post<WorkspaceMember>('/workspaces/invites/accept', { token }),
      revokeInvite: (workspaceId: string, inviteId: string) =>
        del<null>(`/workspaces/${workspaceId}/invites/${inviteId}`),
      removeMember: (workspaceId: string, userId: string) =>
        del<null>(`/workspaces/${workspaceId}/members/${userId}`),
      updateMemberRole: (
        workspaceId: string,
        userId: string,
        role: 'admin' | 'member',
      ) =>
        patch<WorkspaceMember>(`/workspaces/${workspaceId}/members/${userId}`, {
          role,
        }),
    },
    locations: {
      list: (workspaceId: string) =>
        get<Location[]>(`/locations?workspaceId=${workspaceId}`),
      create: (workspaceId: string, input: CreateLocationInput) =>
        post<Location>(`/locations?workspaceId=${workspaceId}`, input),
      update: (id: string, input: UpdateLocationInput) =>
        put<Location>(`/locations/${id}`, input),
      remove: (id: string) => del<null>(`/locations/${id}`),
    },
    supplies: {
      categories: () => get<SupplyCategory[]>('/supply-categories'),
      list: (q?: string) =>
        get<Supply[]>(q ? `/supplies?q=${encodeURIComponent(q)}` : '/supplies'),
    },
    kits: {
      list: (workspaceId: string) =>
        get<Kit[]>(`/kits?workspaceId=${workspaceId}`),
      get: (id: string) => get<Kit>(`/kits/${id}`),
      create: (workspaceId: string, input: CreateKitInput) =>
        post<Kit>(`/kits?workspaceId=${workspaceId}`, input),
      update: (id: string, input: UpdateKitInput) =>
        put<Kit>(`/kits/${id}`, input),
      remove: (id: string) => del<null>(`/kits/${id}`),
      createFromTemplate: (workspaceId: string, input: CreateFromTemplateInput) =>
        post<Kit>(`/kits/from-template?workspaceId=${workspaceId}`, input),
      templates: () => get<KitTemplate[]>('/kits/templates'),
    },
    inventory: {
      list: (workspaceId: string, kitId?: string) => {
        const params = new URLSearchParams({ workspaceId });
        if (kitId) params.set('kitId', kitId);
        return get<InventoryItem[]>(`/inventory?${params}`);
      },
      create: (workspaceId: string, input: CreateInventoryItemInput) =>
        post<InventoryItem>(`/inventory?workspaceId=${workspaceId}`, input),
      update: (id: string, input: UpdateInventoryItemInput) =>
        put<InventoryItem>(`/inventory/${id}`, input),
      remove: (id: string) => del<null>(`/inventory/${id}`),
      expiring: (workspaceId: string, withinDays = 30) =>
        get<InventoryItem[]>(
          `/inventory/expiring?workspaceId=${workspaceId}&withinDays=${withinDays}`,
        ),
      lowStock: (workspaceId: string) =>
        get<InventoryItem[]>(
          `/inventory/low-stock?workspaceId=${workspaceId}`,
        ),
    },
    sharing: {
      shareWithUser: (kitId: string, input: ShareKitWithUserInput) =>
        post<KitAclEntry>(`/sharing/kits/${kitId}/share`, input),
      listShares: (kitId: string) =>
        get<KitAclEntry[]>(`/sharing/kits/${kitId}/shares`),
      revokeShare: (kitId: string, shareId: string) =>
        del<null>(`/sharing/kits/${kitId}/share/${shareId}`),
      createLink: (kitId: string, input: CreateShareLinkInput) =>
        post<ShareLink>(`/sharing/kits/${kitId}/share-link`, input),
      revokeLink: (kitId: string, linkId: string) =>
        del<null>(`/sharing/kits/${kitId}/share-link/${linkId}`),
      sharedWithMe: () => get<Kit[]>('/sharing/kits/shared'),
      redeemLink: (token: string) =>
        post<Kit>(`/sharing/links/${token}/redeem`),
    },
    notifications: {
      list: () => get<Notification[]>('/notifications'),
      markRead: (id: string) => post<Notification>(`/notifications/${id}/read`),
    },
    subscriptions: {
      status: () =>
        get<{
          tier: 'free' | 'premium';
          status: 'active' | 'cancelled' | 'expired';
          expiresAt: string | null;
          entitlement: 'everredi-pro' | null;
        }>('/subscriptions/status'),
    },
  };
}

export type EverrediClient = ReturnType<typeof createEverrediClient>;
