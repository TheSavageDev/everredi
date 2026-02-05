import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface OshaComplianceRule {
  id: string;
  industry: string;
  ruleName: string;
  description: string;
  requiredSupplies: Array<{
    supplyId: string;
    supplyName?: string;
    quantity: number;
    supplyType?: string;
  }>;
  groupSizeMin: number;
  groupSizeMax?: number;
  environment?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceCheck {
  id: string;
  userId: string;
  userKitId: string;
  oshaRuleId: string;
  oshaRuleName?: string;
  complianceStatus: 'compliant' | 'non_compliant' | 'partial';
  complianceScore: number;
  missingItems: Array<{
    supplyId: string;
    supplyName: string;
    requiredQuantity: number;
    actualQuantity: number;
  }>;
  extraItems: Array<{
    supplyId: string;
    supplyName: string;
    quantity: number;
  }>;
  checkedAt: Date;
  notes?: string;
}

// Helper functions to convert PostgreSQL rows
function rowToOshaRule(row: any): OshaComplianceRule {
  return {
    id: row.id,
    industry: row.industry,
    ruleName: row.rule_name,
    description: row.description,
    requiredSupplies: row.required_supplies || [],
    groupSizeMin: row.group_size_min,
    groupSizeMax: row.group_size_max,
    environment: row.environment,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToComplianceCheck(row: any): ComplianceCheck {
  return {
    id: row.id,
    userId: row.user_id,
    userKitId: row.kit_id,
    oshaRuleId: row.osha_rule_id,
    oshaRuleName: row.osha_rule_name,
    complianceStatus: row.compliance_status,
    complianceScore: row.compliance_score,
    missingItems: row.missing_items || [],
    extraItems: row.extra_items || [],
    checkedAt: new Date(row.checked_at),
    notes: row.notes,
  };
}

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async checkCompliance(
    userId: string,
    userKitId: string,
    oshaRuleId?: string,
    industry?: string,
  ): Promise<ComplianceCheck> {
    const isPremium = await this.usersService.isPremiumUser(userId);

    if (!isPremium) {
      // Count existing compliance checks for this kit
      const { count, error: countError } = await this.supabase
        .from('compliance_checks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kit_id', userKitId);

      if (countError) {
        // Log but continue
      }

      const existingChecks = count || 0;
      const maxFreeChecksPerKit = 1;

      if (existingChecks >= maxFreeChecksPerKit) {
        throw new ForbiddenException({
          code: 'COMPLIANCE_LIMIT_REACHED',
          message:
            'You have used your free OSHA compliance check for this kit. Upgrade to premium for unlimited compliance checks.',
        });
      }
    }

    // Get kit items (one row per item type; compliance = actual_quantity vs required)
    const { data: kitItems, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select('supply_id, freeform_name, actual_quantity, required_quantity')
      .eq('kit_id', userKitId);

    if (itemsError) {
      throw new Error(`Failed to get kit items: ${itemsError.message}`);
    }

    // Get compliance rule
    let rule: OshaComplianceRule | null = null;
    if (oshaRuleId) {
      const { data, error } = await this.supabase
        .from('osha_compliance_rules')
        .select('*')
        .eq('id', oshaRuleId)
        .single();

      if (!error && data) {
        rule = rowToOshaRule(data);
      }
    } else if (industry) {
      const { data, error } = await this.supabase
        .from('osha_compliance_rules')
        .select('*')
        .eq('industry', industry)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!error && data) {
        rule = rowToOshaRule(data);
      }
    }

    if (!rule) {
      throw new NotFoundException('Compliance rule not found');
    }

    // Check compliance
    const missingItems: ComplianceCheck['missingItems'] = [];
    const extraItems: ComplianceCheck['extraItems'] = [];

    for (const required of rule.requiredSupplies) {
      const kitItem = (kitItems || []).find(
        (item: any) => item.supply_id === required.supplyId,
      );

      // Read actual quantity directly from database column
      const actualQuantity = kitItem?.actual_quantity ?? 0;

      if (actualQuantity < required.quantity) {
        missingItems.push({
          supplyId: required.supplyId,
          supplyName: required.supplyName || 'Unknown',
          requiredQuantity: required.quantity,
          actualQuantity,
        });
      }
    }

    // Calculate compliance score
    const totalRequired = rule.requiredSupplies.reduce(
      (sum, req) => sum + req.quantity,
      0,
    );
    const totalActual = (kitItems || []).reduce((sum: number, item: any) => {
      // Read actual quantity directly from database column
      const actualQty = item.actual_quantity ?? 0;
      return sum + actualQty;
    }, 0);
    const complianceScore = Math.round((totalActual / totalRequired) * 100);

    let complianceStatus: ComplianceCheck['complianceStatus'] = 'compliant';
    if (complianceScore < 100) {
      complianceStatus =
        missingItems.length === rule.requiredSupplies.length
          ? 'non_compliant'
          : 'partial';
    }

    // Save compliance check
    const now = new Date();
    const { data, error } = await this.supabase
      .from('compliance_checks')
      .insert({
        user_id: userId,
        kit_id: userKitId,
        osha_rule_id: rule.id,
        osha_rule_name: rule.ruleName,
        compliance_status: complianceStatus,
        compliance_score: complianceScore,
        missing_items: missingItems,
        extra_items: extraItems,
        checked_at: now.toISOString(),
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save compliance check: ${error.message}`);
    }

    return rowToComplianceCheck(data);
  }

  async getComplianceChecks(userId: string): Promise<ComplianceCheck[]> {
    const { data, error } = await this.supabase
      .from('compliance_checks')
      .select('*')
      .eq('user_id', userId)
      .order('checked_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get compliance checks: ${error.message}`);
    }

    return (data || []).map(rowToComplianceCheck);
  }

  async getComplianceCheck(
    userId: string,
    checkId: string,
  ): Promise<ComplianceCheck | null> {
    const { data, error } = await this.supabase
      .from('compliance_checks')
      .select('*')
      .eq('id', checkId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return rowToComplianceCheck(data);
  }

  /**
   * Find OSHA rule by kit type (e.g., 'class_a', 'class_b', 'construction')
   */
  async findOshaRuleByType(
    kitType: string,
  ): Promise<OshaComplianceRule | null> {
    // Map common kit types to industry values
    const industryMap: Record<string, string> = {
      class_a: 'class_a',
      class_b: 'class_b',
      construction: 'construction',
      general_industry: 'general',
      general: 'general',
    };

    const industry = industryMap[kitType.toLowerCase()] || kitType;

    // Try to find by industry first
    let { data, error } = await this.supabase
      .from('osha_compliance_rules')
      .select('*')
      .eq('industry', industry)
      .eq('is_active', true)
      .limit(1)
      .single();

    // If not found, try searching by rule name containing the type
    if (error || !data) {
      const searchTerm = kitType.replace('_', ' ');
      const { data: nameData, error: nameError } = await this.supabase
        .from('osha_compliance_rules')
        .select('*')
        .ilike('rule_name', `%${searchTerm}%`)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!nameError && nameData) {
        data = nameData;
        error = null;
      }
    }

    if (error || !data) {
      return null;
    }

    return rowToOshaRule(data);
  }

  /**
   * Check compliance and update kit record directly
   * Used for automatic compliance updates on OSHA kits
   */
  async checkComplianceAndUpdateKit(
    userId: string,
    kitId: string,
    oshaRuleId?: string,
    oshaKitType?: string,
  ): Promise<void> {
    // Find the rule
    let rule: OshaComplianceRule | null = null;

    if (oshaRuleId) {
      const { data, error } = await this.supabase
        .from('osha_compliance_rules')
        .select('*')
        .eq('id', oshaRuleId)
        .single();

      if (!error && data) {
        rule = rowToOshaRule(data);
      }
    } else if (oshaKitType) {
      rule = await this.findOshaRuleByType(oshaKitType);
    }

    if (!rule) {
      throw new NotFoundException(
        `Compliance rule not found for kit type: ${oshaKitType || 'unknown'}`,
      );
    }

    // Get kit items (one row per item type; compliance = actual_quantity vs required)
    const { data: kitItems, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select('supply_id, freeform_name, actual_quantity, required_quantity')
      .eq('kit_id', kitId);

    if (itemsError) {
      throw new Error(`Failed to get kit items: ${itemsError.message}`);
    }

    // Check compliance
    const missingItems: Array<{
      supplyId: string;
      supplyName: string;
      requiredQuantity: number;
      actualQuantity: number;
    }> = [];
    const extraItems: Array<{
      supplyId: string;
      supplyName: string;
      quantity: number;
    }> = [];

    for (const required of rule.requiredSupplies) {
      const kitItem = (kitItems || []).find(
        (item: any) => item.supply_id === required.supplyId,
      );

      // Read actual quantity directly from database column
      const actualQuantity = kitItem?.actual_quantity ?? 0;

      if (actualQuantity < required.quantity) {
        missingItems.push({
          supplyId: required.supplyId,
          supplyName: required.supplyName || 'Unknown',
          requiredQuantity: required.quantity,
          actualQuantity,
        });
      }
    }

    // Calculate compliance score
    const totalRequired = rule.requiredSupplies.reduce(
      (sum, req) => sum + req.quantity,
      0,
    );
    const totalActual = (kitItems || []).reduce((sum: number, item: any) => {
      // Read actual quantity directly from database column
      const actualQty = item.actual_quantity ?? 0;
      return sum + actualQty;
    }, 0);
    const complianceScore = Math.min(
      100,
      Math.max(0, Math.round((totalActual / totalRequired) * 100)),
    );

    let complianceStatus:
      | 'compliant'
      | 'non_compliant'
      | 'partial'
      | 'not_checked' = 'compliant';
    if (complianceScore < 100) {
      complianceStatus =
        missingItems.length === rule.requiredSupplies.length
          ? 'non_compliant'
          : 'partial';
    }

    // Update kit record with compliance data
    const now = new Date();
    const { error: updateError } = await this.supabase
      .from('kits')
      .update({
        compliance_status: complianceStatus,
        compliance_score: complianceScore,
        last_compliance_check_at: now.toISOString(),
        compliance_metadata: {
          missingItems,
          extraItems,
        },
        osha_rule_id: rule.id,
      })
      .eq('id', kitId);

    if (updateError) {
      throw new Error(
        `Failed to update kit compliance status: ${updateError.message}`,
      );
    }

    // Also create a compliance check record for history
    try {
      await this.supabase.from('compliance_checks').insert({
        user_id: userId,
        kit_id: kitId,
        osha_rule_id: rule.id,
        osha_rule_name: rule.ruleName,
        compliance_status: complianceStatus,
        compliance_score: complianceScore,
        missing_items: missingItems,
        extra_items: extraItems,
        checked_at: now.toISOString(),
        created_at: now.toISOString(),
      });
    } catch (error) {
      // Log but don't fail if compliance check record creation fails
      console.warn('Failed to create compliance check record:', error);
    }
  }
}
