# Kit Items Consolidation - Code Migration Guide

## Overview

The `kit_items` table has been consolidated into `inventory_items`. All code references to `kit_items` need to be updated to use `inventory_items` with the `is_requirement` flag.

## Key Changes

### Table Migration
- **Old**: `kit_items` table (separate from `inventory_items`)
- **New**: `inventory_items` table with `kit_id` and `is_requirement` flag

### Data Model Changes

**Old `kit_items` structure:**
```typescript
{
  id: UUID
  user_kit_id: UUID
  supply_id: UUID
  supply_name: string
  inventory_item_id: UUID (optional)
  required_quantity: number
  actual_quantity: number
  status: 'missing' | 'partial' | 'complete'
}
```

**New `inventory_items` structure:**
```typescript
{
  id: UUID
  tenant_id: UUID
  kit_id: UUID (nullable - NULL = not in kit)
  supply_id: UUID (nullable)
  freeform_name: string (nullable)
  supply_name: string
  quantity: number
  is_requirement: boolean (true = requirement/placeholder)
  status: 'active' | 'expired' | 'used' | 'disposed' | 'missing'
  // ... other inventory fields
}
```

## Files Requiring Updates

### 1. `api/src/kits/user-kits.service.ts`

**Key methods to update:**
- `getkitItems()` - Query `inventory_items` where `kit_id` is set
- `createKitItemInstance()` - Insert into `inventory_items` with `kit_id` and `is_requirement`
- `updateKitItemInstance()` - Update `inventory_items` instead of `kit_items`
- `deleteKitItemInstance()` - Delete from `inventory_items`
- `bulkUpdateKitItemsToRequiredQuantity()` - Update `inventory_items`

**Query pattern changes:**
```typescript
// Old
.from('kit_items')
.select('*')
.eq('kit_id', kitId)

// New
.from('inventory_items')
.select('*')
.eq('kit_id', kitId)
// Filter by is_requirement if needed
```

### 2. `api/src/compliance/compliance.service.ts`

**Update:**
- Line 127-130: Query `inventory_items` instead of `kit_items`
- Calculate `actual_quantity` from `inventory_lots` or `quantity` field
- Use `is_requirement = true` for requirements

### 3. `api/src/bulk/bulk-operations.service.ts`

**Update:**
- Line 154, 246: `getkitItems()` calls will automatically use new structure after user-kits.service.ts is updated

### 4. `api/src/kits/template-seed.service.ts`

**Update:**
- Line 337-366: When creating kit from template, insert into `inventory_items` with `is_requirement = true` and `kit_id` set

## Migration Strategy

1. **Update queries** to use `inventory_items` table
2. **Add `is_requirement` flag** where appropriate (requirements vs actual items)
3. **Use `kit_id`** instead of `user_kit_id` or `kit_container_id`
4. **Calculate `actual_quantity`** from `inventory_lots` or use `quantity` field directly
5. **Update status calculation** based on `quantity` vs `required_quantity` (for requirements)

## Example Migration

**Before:**
```typescript
const { data: kitItems } = await this.supabase
  .from('kit_items')
  .select('*')
  .eq('kit_id', kitId);
```

**After:**
```typescript
// Get requirements (is_requirement = true)
const { data: requirements } = await this.supabase
  .from('inventory_items')
  .select('*, inventory_lots(*)')
  .eq('kit_id', kitId)
  .eq('is_requirement', true);

// Get actual items (is_requirement = false)
const { data: actualItems } = await this.supabase
  .from('inventory_items')
  .select('*, inventory_lots(*)')
  .eq('kit_id', kitId)
  .eq('is_requirement', false);
```

## Status Calculation

For requirements, calculate status based on:
- `required_quantity` = `quantity` field (for requirements)
- `actual_quantity` = sum of `inventory_lots.quantity_units` where status = 'active' and not expired
- Status: 'complete' if actual >= required, 'partial' if actual > 0, 'missing' otherwise
