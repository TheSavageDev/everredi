import type {
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

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function mapUser(row: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    subscriptionTier: row.subscriptionTier as User['subscriptionTier'],
    subscriptionStatus: row.subscriptionStatus as User['subscriptionStatus'],
    subscriptionExpiresAt: iso(row.subscriptionExpiresAt),
    isAdmin: row.isAdmin,
    onboardingCompleted: row.onboardingCompleted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapWorkspace(row: {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapMember(row: {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMember['role'];
  createdAt: Date;
  email?: string;
  displayName?: string | null;
}): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapInvite(row: {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member' | 'owner';
  status: WorkspaceInvite['status'];
  invitedBy: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}): WorkspaceInvite {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role === 'owner' ? 'member' : row.role,
    status: row.status,
    invitedBy: row.invitedBy,
    token: row.token,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapLocation(row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  locationType: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Location {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    locationType: row.locationType as Location['locationType'],
    isPrimary: row.isPrimary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSupplyCategory(row: {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  sortOrder: number | null;
}): SupplyCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    iconName: row.iconName,
    sortOrder: row.sortOrder ?? 0,
  };
}

export function mapSupply(row: {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  defaultUnit: string | null;
  typicalShelfLifeDays: number | null;
}): Supply {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    defaultUnit: row.defaultUnit,
    typicalShelfLifeDays: row.typicalShelfLifeDays,
  };
}

export function mapKit(row: {
  id: string;
  workspaceId: string;
  name: string;
  locationId: string | null;
  status: Kit['status'];
  templateId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Kit {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    locationId: row.locationId,
    status: row.status,
    templateId: row.templateId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

export function mapInventory(row: {
  id: string;
  workspaceId: string;
  kitId: string | null;
  supplyId: string | null;
  freeformName: string | null;
  supplyName: string;
  supplyCategoryId: string | null;
  locationId: string | null;
  requiredQuantity: number | null;
  actualQuantity: number | null;
  status: InventoryItem['status'];
  expirationDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InventoryItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kitId: row.kitId,
    supplyId: row.supplyId,
    freeformName: row.freeformName,
    supplyName: row.supplyName,
    supplyCategoryId: row.supplyCategoryId,
    locationId: row.locationId,
    requiredQuantity: row.requiredQuantity,
    actualQuantity: row.actualQuantity,
    status: row.status,
    expirationDate: iso(row.expirationDate),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapShareLink(row: {
  id: string;
  kitId: string;
  ownerId: string;
  linkToken: string;
  permission: string;
  expiresAt: Date | null;
  createdAt: Date;
}): ShareLink {
  return {
    id: row.id,
    kitId: row.kitId,
    ownerId: row.ownerId,
    linkToken: row.linkToken,
    permission: row.permission as 'view' | 'edit',
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapAcl(row: {
  id: string;
  kitId: string;
  userId: string;
  permission: KitAclEntry['permission'];
  createdAt: Date;
}): KitAclEntry {
  return {
    id: row.id,
    kitId: row.kitId,
    userId: row.userId,
    permission: row.permission,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapNotification(row: {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  title: string;
  message: string;
  data: unknown;
  isRead: boolean;
  createdAt: Date;
}): Notification {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    message: row.message,
    data: (row.data as Record<string, unknown> | null) ?? null,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapTemplate(
  row: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    isPublic: boolean;
  },
  items: KitTemplate['items'],
): KitTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    isPublic: row.isPublic,
    items,
  };
}

export function ok<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}
