import { z } from 'zod';

export const memberRoleSchema = z.enum(['owner', 'admin', 'member']);
export const kitPermissionSchema = z.enum(['view', 'edit', 'admin']);
export const kitStatusSchema = z.enum([
  'active',
  'archived',
  'incomplete',
  'complete',
]);
export const inventoryItemStatusSchema = z.enum([
  'complete',
  'partial',
  'missing',
  'used',
  'disposed',
  'expired',
]);
export const locationTypeSchema = z.enum([
  'home',
  'office',
  'vehicle',
  'backpack',
  'general',
]);

export const upsertUserSchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum(['personal', 'shared']).default('shared'),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  locationType: locationTypeSchema.default('general'),
  isPrimary: z.boolean().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export const createKitSchema = z.object({
  name: z.string().trim().min(1).max(255),
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  status: kitStatusSchema.optional(),
  templateId: z.string().uuid().optional().nullable(),
});

export const updateKitSchema = createKitSchema.partial().extend({
  status: kitStatusSchema.optional(),
});

export const inventoryItemFieldsSchema = z.object({
  kitId: z.string().uuid().optional().nullable(),
  supplyId: z.string().uuid().optional().nullable(),
  freeformName: z.string().trim().min(1).max(255).optional().nullable(),
  supplyName: z.string().trim().min(1).max(255).optional(),
  supplyCategoryId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  requiredQuantity: z.number().int().min(0).optional().nullable(),
  actualQuantity: z.number().int().min(0).optional().nullable(),
  status: inventoryItemStatusSchema.optional(),
  expirationDate: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const createInventoryItemSchema = inventoryItemFieldsSchema.refine(
  (v) => Boolean(v.supplyId) || Boolean(v.freeformName) || Boolean(v.supplyName),
  { message: 'Provide supplyId, freeformName, or supplyName' },
);

export const updateInventoryItemSchema = inventoryItemFieldsSchema.partial();

export const createShareLinkSchema = z.object({
  permission: z.enum(['view', 'edit']).default('view'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const shareKitWithUserSchema = z.object({
  userId: z.string().uuid(),
  permission: kitPermissionSchema.exclude(['admin']).default('view'),
});

export const createFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().trim().min(1).max(255).optional(),
  locationId: z.string().uuid().optional().nullable(),
});

export type UpsertUserInput = z.infer<typeof upsertUserSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type CreateKitInput = z.infer<typeof createKitSchema>;
export type UpdateKitInput = z.infer<typeof updateKitSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;
export type ShareKitWithUserInput = z.infer<typeof shareKitWithUserSchema>;
export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
