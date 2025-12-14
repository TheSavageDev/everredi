import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { PublicTemplatesService } from './public-templates.service';

export interface KitTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  isPublic: boolean;
  isAiGenerated: boolean;
  aiPrompt?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class KitTemplatesService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly publicTemplatesService: PublicTemplatesService,
  ) {}

  async getKitTemplates(userId: string): Promise<KitTemplate[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('kitTemplates')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KitTemplate[];
  }

  async getKitTemplate(
    userId: string,
    templateId: string,
  ): Promise<KitTemplate> {
    const doc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('kitTemplates')
      .doc(templateId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException('Kit template not found');
    }

    return { id: doc.id, ...doc.data() } as KitTemplate;
  }

  async createKitTemplate(
    userId: string,
    templateData: Omit<
      KitTemplate,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<KitTemplate> {
    const now = Timestamp.now();
    const docRef = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('kitTemplates')
      .add({
        ...templateData,
        userId,
        createdAt: now,
        updatedAt: now,
      });

    const doc = await docRef.get();
    const template = { id: doc.id, ...doc.data() } as KitTemplate;

    // If template is created as public, sync to public collection
    if (templateData.isPublic) {
      await this.publicTemplatesService.createPublicTemplate({
        name: template.name,
        description: template.description,
        purpose: template.purpose,
        groupSize: template.groupSize,
        environment: template.environment,
        skillLevel: template.skillLevel,
        createdBy: userId,
        publicTemplateId: `${userId}/${template.id}`,
      });
    }

    return template;
  }

  async updateKitTemplate(
    userId: string,
    templateId: string,
    updates: Partial<KitTemplate>,
  ): Promise<KitTemplate> {
    const templateRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('kitTemplates')
      .doc(templateId);

    const existingDoc = await templateRef.get();
    if (!existingDoc.exists) {
      throw new NotFoundException('Kit template not found');
    }

    const existingData = existingDoc.data() as KitTemplate;
    const wasPublic = existingData.isPublic;
    const isNowPublic = updates.isPublic === true;

    // Update the user template
    await templateRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    // Sync to public templates if isPublic changed
    if (isNowPublic && !wasPublic) {
      // Template is being made public - create or update in public collection
      const existingPublicTemplate =
        await this.publicTemplatesService.findPublicTemplateByUserTemplateId(
          userId,
          templateId,
        );

      const templateData = {
        ...existingData,
        ...updates,
      };

      if (existingPublicTemplate) {
        // Update existing public template
        await this.publicTemplatesService.updatePublicTemplate(
          existingPublicTemplate.id,
          {
            name: templateData.name,
            description: templateData.description,
            purpose: templateData.purpose,
            groupSize: templateData.groupSize,
            environment: templateData.environment,
            skillLevel: templateData.skillLevel,
          },
        );
      } else {
        // Create new public template
        await this.publicTemplatesService.createPublicTemplate({
          name: templateData.name,
          description: templateData.description,
          purpose: templateData.purpose,
          groupSize: templateData.groupSize,
          environment: templateData.environment,
          skillLevel: templateData.skillLevel,
          createdBy: userId,
          publicTemplateId: `${userId}/${templateId}`,
        });
      }
    } else if (!isNowPublic && wasPublic) {
      // Template is being made private - remove from public collection
      const existingPublicTemplate =
        await this.publicTemplatesService.findPublicTemplateByUserTemplateId(
          userId,
          templateId,
        );

      if (existingPublicTemplate) {
        await this.publicTemplatesService.deletePublicTemplate(
          existingPublicTemplate.id,
        );
      }
    } else if (isNowPublic && wasPublic) {
      // Template is already public and being updated - sync changes
      const existingPublicTemplate =
        await this.publicTemplatesService.findPublicTemplateByUserTemplateId(
          userId,
          templateId,
        );

      if (existingPublicTemplate) {
        // Merge updates with existing data to handle partial updates
        const templateData = {
          ...existingData,
          ...updates,
        };

        await this.publicTemplatesService.updatePublicTemplate(
          existingPublicTemplate.id,
          {
            name: templateData.name,
            description: templateData.description,
            purpose: templateData.purpose,
            groupSize: templateData.groupSize,
            environment: templateData.environment,
            skillLevel: templateData.skillLevel,
          },
        );
      }
    }

    const doc = await templateRef.get();
    return { id: doc.id, ...doc.data() } as KitTemplate;
  }

  async deleteKitTemplate(userId: string, templateId: string): Promise<void> {
    const templateRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('kitTemplates')
      .doc(templateId);

    const doc = await templateRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Kit template not found');
    }

    await templateRef.delete();
  }

  async getTemplateItems(
    userId: string,
    templateId: string,
  ): Promise<
    Array<{
      supplyId: string;
      supplyName?: string;
      quantity: number;
      notes?: string;
    }>
  > {
    const templateRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('kitTemplates')
      .doc(templateId);

    const templateDoc = await templateRef.get();
    if (!templateDoc.exists) {
      throw new NotFoundException('Kit template not found');
    }

    const itemsSnapshot = await templateRef
      .collection('kitItems')
      .orderBy('sortOrder')
      .get();

    return itemsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        supplyId: data.supplyId,
        supplyName: data.supplyName,
        quantity: data.quantity,
        notes: data.notes,
      };
    });
  }
}
