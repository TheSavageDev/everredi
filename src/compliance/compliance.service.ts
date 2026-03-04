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

    // Get kit items (requirements and actual items)
    const { data: kitItems, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select(
        `
        supply_id,
        freeform_name,
        actual_quantity,
        inventory_lots(
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
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

      // Calculate actual quantity from inventory_lots
      let actualQuantity = 0;
      if (kitItem?.inventory_lots && Array.isArray(kitItem.inventory_lots)) {
        actualQuantity = kitItem.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      } else if (kitItem?.actual_quantity != null) {
        actualQuantity = kitItem.actual_quantity || 0;
      }

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
      // Calculate actual quantity from lots
      let actualQty = 0;
      if (item.inventory_lots && Array.isArray(item.inventory_lots)) {
        actualQty = item.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (lotSum: number, lot: any) => lotSum + (lot.quantity_units || 0),
            0,
          );
      } else if (item.actual_quantity != null) {
        actualQty = item.actual_quantity || 0;
      }
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

  async checkComplianceAndUpdateKit(
    userId: string,
    kitId: string,
    oshaRuleId?: string,
    industry?: string,
  ): Promise<ComplianceCheck> {
    const check = await this.checkCompliance(
      userId,
      kitId,
      oshaRuleId,
      industry,
    );

    // Update the kit row with compliance result
    const { error } = await this.supabase
      .from('kits')
      .update({
        compliance_status: check.complianceStatus,
        compliance_score: check.complianceScore,
        last_compliance_check_at: check.checkedAt.toISOString(),
        compliance_metadata: {
          osha_rule_id: check.oshaRuleId,
          osha_rule_name: check.oshaRuleName,
          missing_items: check.missingItems,
          extra_items: check.extraItems,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', kitId);

    if (error) {
      throw new Error(`Failed to update kit compliance: ${error.message}`);
    }

    return check;
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
}
