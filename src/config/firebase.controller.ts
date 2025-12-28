import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { FirebaseApp } from './firebase.provider';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('firebase')
@UseGuards(AdminGuard) // Only admins can access these endpoints
export class FirebaseController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly firebaseApp: FirebaseApp,
  ) {}

  @Get('health')
  async healthCheck() {
    try {
      // Try to access Firestore to verify connection
      await this.firebaseService.getCollection('users', { limit: 1 });
      return {
        status: 'healthy',
        firestore: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        firestore: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('collections/:collectionPath')
  async getCollection(
    @Param('collectionPath') collectionPath: string,
    @Query('limit') limit?: string,
  ): Promise<Array<{ id: string; [key: string]: unknown }>> {
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.firebaseService.getCollection(collectionPath, options);
  }

  @Get('collections/:collectionPath/:docId')
  async getDocument(
    @Param('collectionPath') collectionPath: string,
    @Param('docId') docId: string,
  ): Promise<{ id: string; [key: string]: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.firebaseService.getDocument(
      collectionPath,
      docId,
      {
        throwIfNotFound: true,
      },
    );
    if (!result) {
      throw new Error('Document not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  @Get('collections/:collectionPath/:parentDocId/:subcollectionPath')
  async getSubcollection(
    @Param('collectionPath') collectionPath: string,
    @Param('parentDocId') parentDocId: string,
    @Param('subcollectionPath') subcollectionPath: string,
    @Query('limit') limit?: string,
  ): Promise<Array<{ id: string; [key: string]: unknown }>> {
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.firebaseService.getSubcollection(
      collectionPath,
      parentDocId,
      subcollectionPath,
      options,
    );
  }

  @Get('collections/:collectionPath/:parentDocId/:subcollectionPath/:docId')
  async getSubcollectionDocument(
    @Param('collectionPath') collectionPath: string,
    @Param('parentDocId') parentDocId: string,
    @Param('subcollectionPath') subcollectionPath: string,
    @Param('docId') docId: string,
  ): Promise<{ id: string; [key: string]: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.firebaseService.getSubcollectionDocument(
      collectionPath,
      parentDocId,
      subcollectionPath,
      docId,
      { throwIfNotFound: true },
    );
    if (!result) {
      throw new Error('Document not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }
}
