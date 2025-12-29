import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

export interface PublicKitTemplate {
  id: string;
  name: string;
  description?: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  isActive: boolean;
  createdBy?: string; // userId who created it, or 'system' for default templates
  publicTemplateId?: string; // Reference to user template if synced from user
  defaultPeopleCount?: number; // Default: 1
  peopleCountOptions?: number[]; // e.g., [2, 4, 8] - additional options beyond default
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class PublicTemplatesService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getPublicTemplates(
    purpose?: string,
    skillLevel?: string,
  ): Promise<PublicKitTemplate[]> {
    let query = this.firestore
      .collection('publicKitTemplates')
      .where('isActive', '==', true);

    if (purpose) {
      query = query.where('purpose', '==', purpose);
    }

    if (skillLevel) {
      query = query.where('skillLevel', '==', skillLevel);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(50).get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as unknown as Omit<PublicKitTemplate, 'id'>),
    })) as PublicKitTemplate[];
  }

  async getPublicTemplate(templateId: string): Promise<PublicKitTemplate> {
    const doc = await this.firestore
      .collection('publicKitTemplates')
      .doc(templateId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException('Public kit template not found');
    }

    return {
      id: doc.id,
      ...(doc.data() as unknown as Omit<PublicKitTemplate, 'id'>),
    } as PublicKitTemplate;
  }

  async createPublicTemplate(
    templateData: Omit<
      PublicKitTemplate,
      'id' | 'isActive' | 'createdAt' | 'updatedAt'
    > & { isActive?: boolean },
  ): Promise<PublicKitTemplate> {
    const now = Timestamp.now();
    const docRef = await this.firestore.collection('publicKitTemplates').add({
      ...templateData,
      isActive: templateData.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await docRef.get();
    return {
      id: doc.id,
      ...(doc.data() as unknown as Omit<PublicKitTemplate, 'id'>),
    } as PublicKitTemplate;
  }

  async updatePublicTemplate(
    templateId: string,
    updates: Partial<PublicKitTemplate>,
  ): Promise<PublicKitTemplate> {
    const templateRef = this.firestore
      .collection('publicKitTemplates')
      .doc(templateId);

    const doc = await templateRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Public template not found');
    }

    await templateRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const updatedDoc = await templateRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as PublicKitTemplate;
  }

  async deletePublicTemplate(templateId: string): Promise<void> {
    const templateRef = this.firestore
      .collection('publicKitTemplates')
      .doc(templateId);

    const doc = await templateRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Public template not found');
    }

    // Soft delete by setting isActive to false
    await templateRef.update({
      isActive: false,
      updatedAt: Timestamp.now(),
    });
  }

  async findPublicTemplateByUserTemplateId(
    userId: string,
    userTemplateId: string,
  ): Promise<PublicKitTemplate | null> {
    const snapshot = await this.firestore
      .collection('publicKitTemplates')
      .where('publicTemplateId', '==', `${userId}/${userTemplateId}`)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...(doc.data() as unknown as Omit<PublicKitTemplate, 'id'>),
    } as PublicKitTemplate;
  }

  /**
   * Calculate item quantity based on people count
   */
  private calculateItemQuantity(
    item: {
      quantity: number;
      scalesWithPeople?: boolean;
      peopleCountQuantities?: Record<number, number>;
    },
    selectedPeopleCount: number,
    defaultPeopleCount: number,
  ): number {
    // If explicit quantity exists for this people count, use it
    if (
      item.peopleCountQuantities &&
      item.peopleCountQuantities[selectedPeopleCount] !== undefined
    ) {
      return item.peopleCountQuantities[selectedPeopleCount];
    }

    // If item scales with people, multiply base quantity
    if (item.scalesWithPeople === true) {
      const multiplier = selectedPeopleCount / defaultPeopleCount;
      return Math.ceil(item.quantity * multiplier);
    }

    // Otherwise, use base quantity unchanged
    return item.quantity;
  }

  async getPublicTemplateItems(
    templateId: string,
    selectedPeopleCount?: number,
  ): Promise<
    Array<{
      supplyId: string;
      supplyName?: string;
      quantity: number;
      notes?: string;
    }>
  > {
    const templateRef = this.firestore
      .collection('publicKitTemplates')
      .doc(templateId);

    const templateDoc = await templateRef.get();
    if (!templateDoc.exists) {
      throw new NotFoundException('Public kit template not found');
    }

    const template = templateDoc.data() as PublicKitTemplate;
    const defaultPeopleCount = template.defaultPeopleCount ?? 1;
    const peopleCount = selectedPeopleCount ?? defaultPeopleCount;

    const itemsSnapshot = await templateRef
      .collection('kitItems')
      .orderBy('sortOrder')
      .get();

    return itemsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const quantity = this.calculateItemQuantity(
        data,
        peopleCount,
        defaultPeopleCount,
      );
      return {
        supplyId: data.supplyId,
        supplyName: data.supplyName,
        quantity,
        notes: data.notes,
      };
    });
  }
}
