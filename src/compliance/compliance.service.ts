import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  checkedAt: Timestamp;
  notes?: string;
}

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
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
      const checksSnapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('userKits')
        .doc(userKitId)
        .collection('complianceChecks')
        .get();

      const existingChecks = checksSnapshot.size;
      const maxFreeChecksPerKit = 1;

      if (existingChecks >= maxFreeChecksPerKit) {
        throw new ForbiddenException({
          code: 'COMPLIANCE_LIMIT_REACHED',
          message:
            'You have used your free OSHA compliance check for this kit. Upgrade to premium for unlimited compliance checks.',
        });
      }
    }

    // Get kit items
    const kitItemsSnapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(userKitId)
      .collection('kitItems')
      .get();

    const kitItems = kitItemsSnapshot.docs.map((doc) => doc.data());

    // Get compliance rule
    let rule: OshaComplianceRule | null = null;
    if (oshaRuleId) {
      const ruleDoc = await this.firestore
        .collection('oshaComplianceRules')
        .doc(oshaRuleId)
        .get();
      if (ruleDoc.exists) {
        rule = { id: ruleDoc.id, ...ruleDoc.data() } as OshaComplianceRule;
      }
    } else if (industry) {
      const rulesSnapshot = await this.firestore
        .collection('oshaComplianceRules')
        .where('industry', '==', industry)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!rulesSnapshot.empty) {
        const ruleDoc = rulesSnapshot.docs[0];
        rule = { id: ruleDoc.id, ...ruleDoc.data() } as OshaComplianceRule;
      }
    }

    if (!rule) {
      throw new NotFoundException('Compliance rule not found');
    }

    // Check compliance
    const missingItems: ComplianceCheck['missingItems'] = [];
    const extraItems: ComplianceCheck['extraItems'] = [];

    for (const required of rule.requiredSupplies) {
      const kitItem = kitItems.find(
        (item) => item.supplyId === required.supplyId,
      );
      const actualQuantity = kitItem?.actualQuantity || 0;

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
    const totalActual = kitItems.reduce(
      (sum, item) => sum + item.actualQuantity,
      0,
    );
    const complianceScore = Math.round((totalActual / totalRequired) * 100);

    let complianceStatus: ComplianceCheck['complianceStatus'] = 'compliant';
    if (complianceScore < 100) {
      complianceStatus =
        missingItems.length === rule.requiredSupplies.length
          ? 'non_compliant'
          : 'partial';
    }

    // Save compliance check
    const now = Timestamp.now();
    const checkRef = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(userKitId)
      .collection('complianceChecks')
      .add({
        userId,
        userKitId,
        oshaRuleId: rule.id,
        oshaRuleName: rule.ruleName,
        complianceStatus,
        complianceScore,
        missingItems,
        extraItems,
        checkedAt: now,
      });

    const checkDoc = await checkRef.get();
    return { id: checkDoc.id, ...checkDoc.data() } as ComplianceCheck;
  }

  async getComplianceChecks(userId: string): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Get all user kits
    const kitsSnapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .get();

    for (const kitDoc of kitsSnapshot.docs) {
      const checksSnapshot = await kitDoc.ref
        .collection('complianceChecks')
        .orderBy('checkedAt', 'desc')
        .get();

      checks.push(
        ...(checksSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ComplianceCheck[]),
      );
    }

    return checks.sort(
      (a, b) => b.checkedAt.toMillis() - a.checkedAt.toMillis(),
    );
  }

  async getComplianceCheck(
    userId: string,
    checkId: string,
  ): Promise<ComplianceCheck | null> {
    // Search across all kits
    const kitsSnapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .get();

    for (const kitDoc of kitsSnapshot.docs) {
      const checkDoc = await kitDoc.ref
        .collection('complianceChecks')
        .doc(checkId)
        .get();

      if (checkDoc.exists) {
        return { id: checkDoc.id, ...checkDoc.data() } as ComplianceCheck;
      }
    }

    return null;
  }
}
