import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from './firebase.provider';

export interface GetDocumentOptions {
  throwIfNotFound?: boolean;
}

export interface QueryOptions {
  limit?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  where?: Array<{
    field: string;
    operator: firestore.WhereFilterOp;
    value: any;
  }>;
}

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  /**
   * Get a document by path
   * @param collectionPath - Collection path (e.g., 'users')
   * @param docId - Document ID
   * @param options - Options including throwIfNotFound
   * @returns Document data with id, or null if not found
   */
  async getDocument<T = any>(
    collectionPath: string,
    docId: string,
    options: GetDocumentOptions = {},
  ): Promise<(T & { id: string }) | null> {
    try {
      const docRef = this.firestore.collection(collectionPath).doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) {
        if (options.throwIfNotFound) {
          throw new NotFoundException(
            `Document not found: ${collectionPath}/${docId}`,
          );
        }
        return null;
      }

      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `getDocument(${collectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Get a document from a subcollection
   * @param collectionPath - Parent collection path (e.g., 'users')
   * @param parentDocId - Parent document ID (e.g., userId)
   * @param subcollectionPath - Subcollection path (e.g., 'inventoryItems')
   * @param docId - Document ID
   * @param options - Options including throwIfNotFound
   * @returns Document data with id, or null if not found
   */
  async getSubcollectionDocument<T = any>(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    docId: string,
    options: GetDocumentOptions = {},
  ): Promise<(T & { id: string }) | null> {
    try {
      const docRef = this.firestore
        .collection(collectionPath)
        .doc(parentDocId)
        .collection(subcollectionPath)
        .doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) {
        if (options.throwIfNotFound) {
          throw new NotFoundException(
            `Document not found: ${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`,
          );
        }
        return null;
      }

      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `getSubcollectionDocument(${collectionPath}/${parentDocId}/${subcollectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Get all documents from a collection
   * @param collectionPath - Collection path
   * @param options - Query options (limit, orderBy, where)
   * @returns Array of documents with ids
   */
  async getCollection<T = any>(
    collectionPath: string,
    options: QueryOptions = {},
  ): Promise<Array<T & { id: string }>> {
    try {
      let query: firestore.Query = this.firestore.collection(collectionPath);

      // Apply where clauses
      if (options.where) {
        for (const condition of options.where) {
          query = query.where(
            condition.field,
            condition.operator,
            condition.value,
          );
        }
      }

      // Apply orderBy
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction);
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<T & { id: string }>;
    } catch (error) {
      this.handleFirestoreError(error, `getCollection(${collectionPath})`);
      throw error;
    }
  }

  /**
   * Get all documents from a subcollection
   * @param collectionPath - Parent collection path
   * @param parentDocId - Parent document ID
   * @param subcollectionPath - Subcollection path
   * @param options - Query options
   * @returns Array of documents with ids
   */
  async getSubcollection<T = any>(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    options: QueryOptions = {},
  ): Promise<Array<T & { id: string }>> {
    try {
      let query: firestore.Query = this.firestore
        .collection(collectionPath)
        .doc(parentDocId)
        .collection(subcollectionPath);

      // Apply where clauses
      if (options.where) {
        for (const condition of options.where) {
          query = query.where(
            condition.field,
            condition.operator,
            condition.value,
          );
        }
      }

      // Apply orderBy
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction);
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<T & { id: string }>;
    } catch (error) {
      this.handleFirestoreError(
        error,
        `getSubcollection(${collectionPath}/${parentDocId}/${subcollectionPath})`,
      );
      throw error;
    }
  }

  /**
   * Create or update a document
   * @param collectionPath - Collection path
   * @param docId - Document ID
   * @param data - Document data
   * @param merge - Whether to merge with existing data (default: false)
   * @returns Created/updated document with id
   */
  async setDocument<T = any>(
    collectionPath: string,
    docId: string,
    data: Partial<T>,
    merge = false,
  ): Promise<T & { id: string }> {
    try {
      const docRef = this.firestore.collection(collectionPath).doc(docId);

      if (merge) {
        await docRef.set(data, { merge: true });
      } else {
        await docRef.set({
          ...data,
          id: docId,
          updatedAt: Timestamp.now(),
        });
      }

      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `setDocument(${collectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Create or update a document in a subcollection
   * @param collectionPath - Parent collection path
   * @param parentDocId - Parent document ID
   * @param subcollectionPath - Subcollection path
   * @param docId - Document ID
   * @param data - Document data
   * @param merge - Whether to merge with existing data (default: false)
   * @returns Created/updated document with id
   */
  async setSubcollectionDocument<T = any>(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    docId: string,
    data: Partial<T>,
    merge = false,
  ): Promise<T & { id: string }> {
    try {
      const docRef = this.firestore
        .collection(collectionPath)
        .doc(parentDocId)
        .collection(subcollectionPath)
        .doc(docId);

      if (merge) {
        await docRef.set(data, { merge: true });
      } else {
        await docRef.set({
          ...data,
          id: docId,
          updatedAt: Timestamp.now(),
        });
      }

      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `setSubcollectionDocument(${collectionPath}/${parentDocId}/${subcollectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Add a new document (auto-generated ID)
   * @param collectionPath - Collection path
   * @param data - Document data
   * @returns Created document with id
   */
  async addDocument<T = any>(
    collectionPath: string,
    data: Partial<T>,
  ): Promise<T & { id: string }> {
    try {
      const docRef = await this.firestore.collection(collectionPath).add({
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(error, `addDocument(${collectionPath})`);
      throw error;
    }
  }

  /**
   * Add a new document to a subcollection (auto-generated ID)
   * @param collectionPath - Parent collection path
   * @param parentDocId - Parent document ID
   * @param subcollectionPath - Subcollection path
   * @param data - Document data
   * @returns Created document with id
   */
  async addSubcollectionDocument<T = any>(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    data: Partial<T>,
  ): Promise<T & { id: string }> {
    try {
      const docRef = await this.firestore
        .collection(collectionPath)
        .doc(parentDocId)
        .collection(subcollectionPath)
        .add({
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `addSubcollectionDocument(${collectionPath}/${parentDocId}/${subcollectionPath})`,
      );
      throw error;
    }
  }

  /**
   * Update a document
   * @param collectionPath - Collection path
   * @param docId - Document ID
   * @param data - Update data
   * @returns Updated document with id
   */
  async updateDocument<T = any>(
    collectionPath: string,
    docId: string,
    data: Partial<T>,
  ): Promise<T & { id: string }> {
    try {
      const docRef = this.firestore.collection(collectionPath).doc(docId);
      await docRef.update({
        ...data,
        updatedAt: Timestamp.now(),
      });

      const doc = await docRef.get();
      if (!doc.exists) {
        throw new NotFoundException(
          `Document not found: ${collectionPath}/${docId}`,
        );
      }

      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `updateDocument(${collectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Update a document in a subcollection
   * @param collectionPath - Parent collection path
   * @param parentDocId - Parent document ID
   * @param subcollectionPath - Subcollection path
   * @param docId - Document ID
   * @param data - Update data
   * @returns Updated document with id
   */
  async updateSubcollectionDocument<T = any>(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    docId: string,
    data: Partial<T>,
  ): Promise<T & { id: string }> {
    try {
      const docRef = this.firestore
        .collection(collectionPath)
        .doc(parentDocId)
        .collection(subcollectionPath)
        .doc(docId);
      await docRef.update({
        ...data,
        updatedAt: Timestamp.now(),
      });

      const doc = await docRef.get();
      if (!doc.exists) {
        throw new NotFoundException(
          `Document not found: ${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`,
        );
      }

      return { id: doc.id, ...doc.data() } as T & { id: string };
    } catch (error) {
      this.handleFirestoreError(
        error,
        `updateSubcollectionDocument(${collectionPath}/${parentDocId}/${subcollectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Delete a document
   * @param collectionPath - Collection path
   * @param docId - Document ID
   */
  async deleteDocument(collectionPath: string, docId: string): Promise<void> {
    try {
      await this.firestore.collection(collectionPath).doc(docId).delete();
    } catch (error) {
      this.handleFirestoreError(
        error,
        `deleteDocument(${collectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Delete a document from a subcollection
   * @param collectionPath - Parent collection path
   * @param parentDocId - Parent document ID
   * @param subcollectionPath - Subcollection path
   * @param docId - Document ID
   */
  async deleteSubcollectionDocument(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    docId: string,
  ): Promise<void> {
    try {
      await this.firestore
        .collection(collectionPath)
        .doc(parentDocId)
        .collection(subcollectionPath)
        .doc(docId)
        .delete();
    } catch (error) {
      this.handleFirestoreError(
        error,
        `deleteSubcollectionDocument(${collectionPath}/${parentDocId}/${subcollectionPath}/${docId})`,
      );
      throw error;
    }
  }

  /**
   * Create a batch for bulk operations
   * @returns Firestore batch
   */
  createBatch(): firestore.WriteBatch {
    return this.firestore.batch();
  }

  /**
   * Get a document reference
   * @param collectionPath - Collection path
   * @param docId - Document ID
   * @returns Document reference
   */
  getDocumentRef(
    collectionPath: string,
    docId: string,
  ): firestore.DocumentReference {
    return this.firestore.collection(collectionPath).doc(docId);
  }

  /**
   * Get a subcollection document reference
   * @param collectionPath - Parent collection path
   * @param parentDocId - Parent document ID
   * @param subcollectionPath - Subcollection path
   * @param docId - Document ID
   * @returns Document reference
   */
  getSubcollectionDocumentRef(
    collectionPath: string,
    parentDocId: string,
    subcollectionPath: string,
    docId: string,
  ): firestore.DocumentReference {
    return this.firestore
      .collection(collectionPath)
      .doc(parentDocId)
      .collection(subcollectionPath)
      .doc(docId);
  }

  /**
   * Handle Firestore errors with helpful messages
   */
  private handleFirestoreError(error: unknown, operation: string): void {
    const firestoreError = error as {
      code?: number | string;
      message?: string;
    };

    if (firestoreError.code === 5 || firestoreError.code === 'NOT_FOUND') {
      this.logger.error(
        `Firestore database not found during ${operation}. Please ensure:\n` +
          '  1. Firestore is enabled in your Firebase Console\n' +
          '  2. The database exists in your Firebase project\n' +
          '  3. Your FIREBASE_PROJECT_ID matches your Firebase project\n' +
          '  4. If using a named database, set FIREBASE_DATABASE_ID in your .env file',
      );
    } else {
      this.logger.error(
        `Firestore error during ${operation}: ${firestoreError.message || 'Unknown error'}`,
      );
    }
  }
}
