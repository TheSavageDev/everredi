import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a mock SupabaseClient for testing
 * Supports common query patterns: from().select().eq().order().single() etc.
 */
export function createSupabaseClientMock(): SupabaseClient {
  const mockData: Map<string, any[]> = new Map();
  const mockDocuments: Map<string, any> = new Map();

  // Helper to get table data
  const getTableData = (table: string): any[] => {
    return mockData.get(table) || [];
  };

  // Helper to set table data
  const setTableData = (table: string, data: any[]): void => {
    mockData.set(table, data);
  };

  // Helper to get a single document
  const getDocument = (table: string, id: string): any | null => {
    const key = `${table}:${id}`;
    return mockDocuments.get(key) || null;
  };

  // Execute query helper
  const executeQuery = (
    table: string,
    filters: Array<{ field: string; operator: string; value: any }>,
    orderBy: { field: string; ascending: boolean } | null,
    limitCount: number | null,
    singleMode: boolean,
    selectFields: string[] | null,
  ) => {
    let result = [...getTableData(table)];

    // Apply filters
    for (const filter of filters) {
      result = result.filter((row: any) => {
        const rowValue = row[filter.field];
        switch (filter.operator) {
          case 'eq':
            return rowValue === filter.value;
          case 'neq':
            return rowValue !== filter.value;
          case 'gt':
            return rowValue > filter.value;
          case 'gte':
            return rowValue >= filter.value;
          case 'lt':
            return rowValue < filter.value;
          case 'lte':
            return rowValue <= filter.value;
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(rowValue);
          default:
            return true;
        }
      });
    }

    // Apply ordering
    if (orderBy) {
      result.sort((a: any, b: any) => {
        const aVal = a[orderBy.field];
        const bVal = b[orderBy.field];
        const direction = orderBy.ascending ? 1 : -1;
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    // Apply limit
    if (limitCount !== null) {
      result = result.slice(0, limitCount);
    }

    // Apply select fields
    if (selectFields) {
      result = result.map((row: any) => {
        const selected: any = {};
        selectFields.forEach((field: string) => {
          if (field === '*') {
            Object.assign(selected, row);
          } else {
            selected[field] = row[field];
          }
        });
        return selected;
      });
    }

    // Handle single mode
    if (singleMode) {
      if (result.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'No rows returned' } };
      }
      result = result[0];
    }

    return { data: result, error: null };
  };

  // Create a chainable query builder mock
  const createQueryBuilder = (table: string) => {
    const state = {
      filters: [] as Array<{ field: string; operator: string; value: any }>,
      orderBy: null as { field: string; ascending: boolean } | null,
      limitCount: null as number | null,
      singleMode: false,
      selectFields: null as string[] | null,
    };

    const builder = {
      select: jest.fn((fields?: string) => {
        state.selectFields = fields ? (Array.isArray(fields) ? fields : [fields]) : null;
        return builder;
      }),

      eq: jest.fn((field: string, value: any) => {
        state.filters.push({ field, operator: 'eq', value });
        return builder;
      }),

      neq: jest.fn((field: string, value: any) => {
        state.filters.push({ field, operator: 'neq', value });
        return builder;
      }),

      gt: jest.fn((field: string, value: any) => {
        state.filters.push({ field, operator: 'gt', value });
        return builder;
      }),

      gte: jest.fn((field: string, value: any) => {
        state.filters.push({ field, operator: 'gte', value });
        return builder;
      }),

      lt: jest.fn((field: string, value: any) => {
        state.filters.push({ field, operator: 'lt', value });
        return builder;
      }),

      lte: jest.fn((field: string, value: any) => {
        state.filters.push({ field, operator: 'lte', value });
        return builder;
      }),

      in: jest.fn((field: string, values: any[]) => {
        state.filters.push({ field, operator: 'in', value: values });
        return builder;
      }),

      order: jest.fn((field: string, options?: { ascending?: boolean } | string) => {
        const ascending = typeof options === 'object' ? (options?.ascending !== false) : options !== 'desc';
        state.orderBy = { field, ascending };
        return builder;
      }),

      limit: jest.fn((count: number) => {
        state.limitCount = count;
        return builder;
      }),

      single: jest.fn(() => {
        state.singleMode = true;
        return builder;
      }),

      maybeSingle: jest.fn(() => {
        state.singleMode = true;
        return builder;
      }),

      insert: jest.fn((values: any) => {
        const insertData = Array.isArray(values) ? values : [values];
        const newRows = insertData.map((row: any) => {
          const id = row.id || `id-${Date.now()}-${Math.random()}`;
          const newRow = {
            ...row,
            id,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          };
          mockDocuments.set(`${table}:${id}`, newRow);
          return newRow;
        });
        const existing = getTableData(table);
        setTableData(table, [...existing, ...newRows]);
        return Promise.resolve({ data: Array.isArray(values) ? newRows : newRows[0], error: null });
      }),

      update: jest.fn((values: any) => {
        // Apply filters to find matching rows
        let matchingRows = getTableData(table);
        
        for (const filter of state.filters) {
          matchingRows = matchingRows.filter((row: any) => {
            const rowValue = row[filter.field];
            switch (filter.operator) {
              case 'eq':
                return rowValue === filter.value;
              case 'neq':
                return rowValue !== filter.value;
              case 'gt':
                return rowValue > filter.value;
              case 'gte':
                return rowValue >= filter.value;
              case 'lt':
                return rowValue < filter.value;
              case 'lte':
                return rowValue <= filter.value;
              case 'in':
                return Array.isArray(filter.value) && filter.value.includes(rowValue);
              default:
                return true;
            }
          });
        }

        // Update matching rows
        const updatedRows = matchingRows.map((row: any) => {
          const updated = {
            ...row,
            ...values,
            updated_at: new Date().toISOString(),
          };
          mockDocuments.set(`${table}:${row.id}`, updated);
          return updated;
        });

        // Update in table data
        const allData = getTableData(table);
        const updatedData = allData.map((row: any) => {
          const updated = updatedRows.find((ur: any) => ur.id === row.id);
          return updated || row;
        });
        setTableData(table, updatedData);

        return Promise.resolve({ 
          data: state.singleMode ? (updatedRows[0] || null) : updatedRows, 
          error: null 
        });
      }),

      delete: jest.fn(() => {
        // Apply filters to find matching rows
        let matchingRows = getTableData(table);
        
        for (const filter of state.filters) {
          matchingRows = matchingRows.filter((row: any) => {
            const rowValue = row[filter.field];
            switch (filter.operator) {
              case 'eq':
                return rowValue === filter.value;
              case 'neq':
                return rowValue !== filter.value;
              case 'gt':
                return rowValue > filter.value;
              case 'gte':
                return rowValue >= filter.value;
              case 'lt':
                return rowValue < filter.value;
              case 'lte':
                return rowValue <= filter.value;
              case 'in':
                return Array.isArray(filter.value) && filter.value.includes(rowValue);
              default:
                return true;
            }
          });
        }

        // Delete matching rows
        const allData = getTableData(table);
        const remainingData = allData.filter((row: any) => !matchingRows.some((mr: any) => mr.id === row.id));
        setTableData(table, remainingData);

        // Remove from documents
        matchingRows.forEach((row: any) => {
          mockDocuments.delete(`${table}:${row.id}`);
        });

        return Promise.resolve({ data: null, error: null });
      }),
    };

    // Create a promise that executes the query when awaited
    const createPromise = (): Promise<{ data: any; error: any }> => {
      return new Promise((resolve, reject) => {
        const result = executeQuery(
          table,
          state.filters,
          state.orderBy,
          state.limitCount,
          state.singleMode,
          state.selectFields,
        );
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result);
        }
      });
    };

    // Make the builder thenable (Promise-like)
    const promise = createPromise();
    const thenable = Object.assign(builder, promise);
    
    return thenable as any;
  };

  const mockClient = {
    from: jest.fn((table: string) => createQueryBuilder(table)),
    
    // Helper methods for test setup
    _setMockData: (table: string, data: any[]) => {
      setTableData(table, data);
    },
    _setMockDocument: (table: string, id: string, doc: any) => {
      mockDocuments.set(`${table}:${id}`, doc);
      const existing = getTableData(table);
      const index = existing.findIndex((row: any) => row.id === id);
      if (index >= 0) {
        existing[index] = doc;
      } else {
        existing.push(doc);
      }
      setTableData(table, existing);
    },
    _clearAll: () => {
      mockData.clear();
      mockDocuments.clear();
    },
  } as unknown as SupabaseClient;

  return mockClient;
}
