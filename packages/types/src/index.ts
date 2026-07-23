export type MemberRole = 'owner' | 'admin' | 'member';
export type KitPermission = 'view' | 'edit' | 'admin';
export type KitStatus = 'active' | 'archived' | 'incomplete' | 'complete';
export type InventoryItemStatus =
  | 'complete'
  | 'partial'
  | 'missing'
  | 'used'
  | 'disposed'
  | 'expired';
export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type LocationType =
  | 'home'
  | 'office'
  | 'vehicle'
  | 'backpack'
  | 'general';

/** Single entitlement ID — never use everredi_pro */
export const EVERREDI_PRO_ENTITLEMENT = 'everredi-pro' as const;

export const FREE_LIMITS = {
  kits: 5,
  inventoryItems: 100,
  locations: 2,
  workspaceMembers: 3,
} as const;

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  email?: string;
  displayName?: string | null;
  createdAt: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<MemberRole, 'owner'>;
  status: InviteStatus;
  invitedBy: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface Location {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  locationType: LocationType;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyCategory {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  sortOrder: number;
}

export interface Supply {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  defaultUnit: string | null;
  typicalShelfLifeDays: number | null;
}

export interface Kit {
  id: string;
  workspaceId: string;
  name: string;
  locationId: string | null;
  status: KitStatus;
  templateId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface InventoryItem {
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
  status: InventoryItemStatus;
  expirationDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KitTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isPublic: boolean;
  items: KitTemplateItem[];
}

export interface KitTemplateItem {
  id: string;
  supplyId: string | null;
  freeformName: string | null;
  supplyName: string;
  requiredQuantity: number;
}

export interface ShareLink {
  id: string;
  kitId: string;
  ownerId: string;
  linkToken: string;
  permission: 'view' | 'edit';
  expiresAt: string | null;
  createdAt: string;
}

export interface KitAclEntry {
  id: string;
  kitId: string;
  userId: string;
  permission: KitPermission;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  error?: string;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
