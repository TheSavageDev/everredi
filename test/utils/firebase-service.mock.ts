import { FirebaseService } from '../../src/config/firebase.service';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Creates a mock FirebaseService for testing
 */
export function createFirebaseServiceMock(): Partial<FirebaseService> {
  const mockData: Map<string, any[]> = new Map();
  const mockDocuments: Map<string, any> = new Map();

  return {
    getCollection: jest.fn(
      async <T = any>(
        collectionPath: string,
        options?: any,
      ): Promise<Array<T & { id: string }>> => {
        const data = mockData.get(collectionPath) || [];
        let result = [...data];

        // Apply where filters
        if (options?.where) {
          for (const condition of options.where) {
            result = result.filter((item: any) => {
              const value = item[condition.field];
              switch (condition.operator) {
                case '==':
                  return value === condition.value;
                case '!=':
                  return value !== condition.value;
                case '>':
                  return value > condition.value;
                case '>=':
                  return value >= condition.value;
                case '<':
                  return value < condition.value;
                case '<=':
                  return value <= condition.value;
                default:
                  return true;
              }
            });
          }
        }

        // Apply orderBy
        if (options?.orderBy) {
          result.sort((a: any, b: any) => {
            const aVal = a[options.orderBy.field];
            const bVal = b[options.orderBy.field];
            const direction = options.orderBy.direction === 'desc' ? -1 : 1;
            if (aVal < bVal) return -1 * direction;
            if (aVal > bVal) return 1 * direction;
            return 0;
          });
        }

        // Apply limit
        if (options?.limit) {
          result = result.slice(0, options.limit);
        }

        return result as Array<T & { id: string }>;
      },
    ),

    getDocument: jest.fn(
      async <T = any>(
        collectionPath: string,
        docId: string,
        options?: any,
      ): Promise<(T & { id: string }) | null> => {
        const key = `${collectionPath}/${docId}`;
        const doc = mockDocuments.get(key);
        if (!doc && options?.throwIfNotFound) {
          throw new Error(`Document not found: ${collectionPath}/${docId}`);
        }
        return doc || null;
      },
    ),

    getSubcollection: jest.fn(
      async <T = any>(
        collectionPath: string,
        parentDocId: string,
        subcollectionPath: string,
        options?: any,
      ): Promise<Array<T & { id: string }>> => {
        const key = `${collectionPath}/${parentDocId}/${subcollectionPath}`;
        const data = mockData.get(key) || [];
        let result = [...data];

        // Apply where filters
        if (options?.where) {
          for (const condition of options.where) {
            result = result.filter((item: any) => {
              const value = item[condition.field];
              switch (condition.operator) {
                case '==':
                  return value === condition.value;
                case '!=':
                  return value !== condition.value;
                case '>':
                  return value > condition.value;
                case '>=':
                  return value >= condition.value;
                case '<':
                  return value < condition.value;
                case '<=':
                  return value <= condition.value;
                default:
                  return true;
              }
            });
          }
        }

        // Apply orderBy
        if (options?.orderBy) {
          result.sort((a: any, b: any) => {
            const aVal = a[options.orderBy.field];
            const bVal = b[options.orderBy.field];
            const direction = options.orderBy.direction === 'desc' ? -1 : 1;
            if (aVal < bVal) return -1 * direction;
            if (aVal > bVal) return 1 * direction;
            return 0;
          });
        }

        // Apply limit
        if (options?.limit) {
          result = result.slice(0, options.limit);
        }

        return result as Array<T & { id: string }>;
      },
    ),

    getSubcollectionDocument: jest.fn(
      async <T = any>(
        collectionPath: string,
        parentDocId: string,
        subcollectionPath: string,
        docId: string,
        options?: any,
      ): Promise<(T & { id: string }) | null> => {
        const key = `${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`;
        const doc = mockDocuments.get(key);
        if (!doc && options?.throwIfNotFound) {
          throw new Error(
            `Document not found: ${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`,
          );
        }
        return doc || null;
      },
    ),

    addDocument: jest.fn(
      async <T = any>(
        collectionPath: string,
        data: Partial<T>,
      ): Promise<T & { id: string }> => {
        const id = `doc-${Date.now()}-${Math.random()}`;
        const doc = {
          id,
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        const existing = mockData.get(collectionPath) || [];
        mockData.set(collectionPath, [...existing, doc]);
        return doc as T & { id: string };
      },
    ),

    addSubcollectionDocument: jest.fn(
      async <T = any>(
        collectionPath: string,
        parentDocId: string,
        subcollectionPath: string,
        data: Partial<T>,
      ): Promise<T & { id: string }> => {
        const id = `doc-${Date.now()}-${Math.random()}`;
        const key = `${collectionPath}/${parentDocId}/${subcollectionPath}`;
        const doc = {
          id,
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        const existing = mockData.get(key) || [];
        mockData.set(key, [...existing, doc]);
        return doc as T & { id: string };
      },
    ),

    updateDocument: jest.fn(
      async <T = any>(
        collectionPath: string,
        docId: string,
        data: Partial<T>,
      ): Promise<T & { id: string }> => {
        const key = `${collectionPath}/${docId}`;
        const existing = mockDocuments.get(key);
        if (!existing) {
          throw new Error(`Document not found: ${collectionPath}/${docId}`);
        }
        const updated = {
          ...existing,
          ...data,
          updatedAt: Timestamp.now(),
        };
        mockDocuments.set(key, updated);
        return updated as T & { id: string };
      },
    ),

    updateSubcollectionDocument: jest.fn(
      async <T = any>(
        collectionPath: string,
        parentDocId: string,
        subcollectionPath: string,
        docId: string,
        data: Partial<T>,
      ): Promise<T & { id: string }> => {
        const key = `${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`;
        const existing = mockDocuments.get(key);
        if (!existing) {
          throw new Error(
            `Document not found: ${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`,
          );
        }
        const updated = {
          ...existing,
          ...data,
          updatedAt: Timestamp.now(),
        };
        mockDocuments.set(key, updated);
        return updated as T & { id: string };
      },
    ),

    deleteDocument: jest.fn(
      async (collectionPath: string, docId: string): Promise<void> => {
        const key = `${collectionPath}/${docId}`;
        mockDocuments.delete(key);
      },
    ),

    deleteSubcollectionDocument: jest.fn(
      async (
        collectionPath: string,
        parentDocId: string,
        subcollectionPath: string,
        docId: string,
      ): Promise<void> => {
        const key = `${collectionPath}/${parentDocId}/${subcollectionPath}/${docId}`;
        mockDocuments.delete(key);
      },
    ),

    createBatch: jest.fn(() => {
      const updates: Array<{ ref: any; data: any }> = [];
      const deletes: Array<any> = [];

      return {
        update: jest.fn((ref: any, data: any) => {
          updates.push({ ref, data });
        }),
        delete: jest.fn((ref: any) => {
          deletes.push(ref);
        }),
        commit: jest.fn(async () => {
          // Apply updates and deletes
          for (const { ref, data } of updates) {
            // In a real implementation, this would update the document
            // For testing, we'll just track the calls
          }
          for (const ref of deletes) {
            // In a real implementation, this would delete the document
            // For testing, we'll just track the calls
          }
        }),
      };
    }),

    getSubcollectionDocumentRef: jest.fn((...args: any[]) => ({
      id: args[args.length - 1],
      path: args.join('/'),
    })),

    // Helper methods for test setup
    _setMockData: (key: string, data: any[]) => {
      mockData.set(key, data);
    },
    _setMockDocument: (key: string, doc: any) => {
      mockDocuments.set(key, doc);
    },
    _clearAll: () => {
      mockData.clear();
      mockDocuments.clear();
    },
  } as any;
}
