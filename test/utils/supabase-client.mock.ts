import type { SupabaseClient } from '@supabase/supabase-js';

export interface TestSupabaseClient extends SupabaseClient {
  _setMockData: (table: string, data: any[]) => void;
  _setMockDocument: (table: string, id: string, doc: any) => void;
  _clearAll: () => void;
}

/**
 * Creates a mock SupabaseClient for testing
 * Supports common query patterns: from().select().eq().order().single() etc.
 */
export function createSupabaseClientMock(): TestSupabaseClient {
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

  // Execute query helper
  const executeQuery = (
    table: string,
    filters: Array<{ field: string; operator: string; value: any }>,
    orderBy: { field: string; ascending: boolean } | null,
    limitCount: number | null,
    singleMode: boolean,
    selectFields: string[] | null,
    countOptions?: {
      count?: 'exact' | 'estimated' | 'planned';
      head?: boolean;
    },
    state?: any,
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
            return (
              Array.isArray(filter.value) && filter.value.includes(rowValue)
            );
          default:
            return true;
        }
      });
    }

    // Handle count query - but only after applying filters
    // We'll check this at the end after all filtering is done

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

    // Handle count query with head option - return count only
    if (countOptions?.count && countOptions?.head) {
      return { data: null, error: null, count: result.length };
    }

    // Handle single mode
    if (singleMode) {
      if (result.length === 0) {
        // maybeSingle returns null on no results, single throws error
        if (state?.maybeSingleMode) {
          return { data: null, error: null };
        }
        const error: any = new Error('No rows returned');
        error.code = 'PGRST116';
        error.message = 'No rows returned';
        return { data: null, error };
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
      maybeSingleMode: false,
      selectFields: null as string[] | null,
    };

    // Create builder object with all methods defined
    const builder: any = {};

    // Define all chainable methods - they all return builder for chaining
    builder.select = (
      fields?: string | string[],
      options?: { count?: 'exact' | 'estimated' | 'planned'; head?: boolean },
    ) => {
      if (fields) {
        if (Array.isArray(fields)) {
          state.selectFields = fields;
        } else if (typeof fields === 'string') {
          // Handle comma-separated fields like 'id, referral_rewards'
          state.selectFields = fields.split(',').map((f) => f.trim());
        } else {
          state.selectFields = [fields];
        }
      } else {
        state.selectFields = null;
      }
      (state as any).countOptions = options;
      return builder;
    };

    builder.eq = (field: string, value: any) => {
      state.filters.push({ field, operator: 'eq', value });
      return builder;
    };

    builder.limit = (count: number) => {
      state.limitCount = count;
      return builder;
    };

    builder.neq = (field: string, value: any) => {
      state.filters.push({ field, operator: 'neq', value });
      return builder;
    };

    builder.gt = (field: string, value: any) => {
      state.filters.push({ field, operator: 'gt', value });
      return builder;
    };

    builder.gte = (field: string, value: any) => {
      state.filters.push({ field, operator: 'gte', value });
      return builder;
    };

    builder.lt = (field: string, value: any) => {
      state.filters.push({ field, operator: 'lt', value });
      return builder;
    };

    builder.lte = (field: string, value: any) => {
      state.filters.push({ field, operator: 'lte', value });
      return builder;
    };

    builder.in = (field: string, values: any[]) => {
      state.filters.push({ field, operator: 'in', value: values });
      return builder;
    };

    builder.order = (
      field: string,
      options?: { ascending?: boolean } | string,
    ) => {
      const ascending =
        typeof options === 'object'
          ? options?.ascending !== false
          : options !== 'desc';
      state.orderBy = { field, ascending };
      return builder;
    };

    builder.single = () => {
      state.singleMode = true;
      return builder;
    };

    builder.maybeSingle = () => {
      // maybeSingle doesn't throw error on no results, just returns null
      state.maybeSingleMode = true;
      state.singleMode = true;
      return builder;
    };

    builder.insert = jest.fn((values: any) => {
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

      // If insert is called without .select(), return a simple promise
      // This handles cases like location.insert() without select
      const simpleInsertPromise = Promise.resolve({
        data: newRows,
        error: null,
      });

      // Create a new state for the insert builder
      const insertState = {
        singleMode: false,
        selectFields: null as string[] | null,
      };

      // Return a builder that supports .select().single() chain
      const insertBuilder: any = {
        select: jest.fn((fields?: string | string[]) => {
          insertState.selectFields = fields
            ? Array.isArray(fields)
              ? fields
              : [fields]
            : null;
          return insertBuilder;
        }),
        single: jest.fn(() => {
          insertState.singleMode = true;
          return insertBuilder;
        }),
        then: jest.fn(
          (onResolve?: (value: any) => any, onReject?: (error: any) => any) => {
            // If single mode, return first row, otherwise return array
            let result: any;
            if (insertState.singleMode) {
              result = newRows[0];
            } else {
              result = Array.isArray(values) ? newRows : newRows[0];
            }

            // Apply select fields if specified
            if (insertState.selectFields && result) {
              if (Array.isArray(result)) {
                result = result.map((row: any) => {
                  const selected: any = {};
                  insertState.selectFields!.forEach((field: string) => {
                    if (field === '*') {
                      Object.assign(selected, row);
                    } else {
                      selected[field] = row[field];
                    }
                  });
                  return selected;
                });
              } else {
                const selected: any = {};
                insertState.selectFields.forEach((field: string) => {
                  if (field === '*') {
                    Object.assign(selected, result);
                  } else {
                    selected[field] = result[field];
                  }
                });
                result = selected;
              }
            }

            const response = { data: result, error: null };
            return Promise.resolve(response).then(onResolve, onReject);
          },
        ),
        catch: jest.fn((onReject?: (error: any) => any) => {
          return Promise.resolve({ data: null, error: null }).catch(onReject);
        }),
        finally: jest.fn((onFinally?: () => any) => {
          return Promise.resolve({ data: null, error: null }).finally(
            onFinally,
          );
        }),
        [Symbol.toStringTag]: 'Promise',
      };

      // Make insertBuilder also a promise so it can be awaited directly
      // This handles cases like: await supabase.from('table').insert({...})
      Object.setPrototypeOf(insertBuilder, Promise.prototype);
      Object.assign(insertBuilder, simpleInsertPromise);

      return insertBuilder;
    });

    builder.update = jest.fn((values: any) => {
      // Return a builder that supports .eq() chain after update
      const updateBuilder: any = {
        eq: jest.fn((field: string, value: any) => {
          state.filters.push({ field, operator: 'eq', value });
          return updateBuilder;
        }),
        select: jest.fn((fields?: string | string[]) => {
          state.selectFields = fields
            ? Array.isArray(fields)
              ? fields
              : [fields]
            : null;
          return updateBuilder;
        }),
        single: jest.fn(() => {
          state.singleMode = true;
          return updateBuilder;
        }),
        limit: jest.fn((count: number) => {
          state.limitCount = count;
          return updateBuilder;
        }),
        then: jest.fn((onResolve?: (value: any) => any) => {
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
                  return (
                    Array.isArray(filter.value) &&
                    filter.value.includes(rowValue)
                  );
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

          let result;
          let error: { code?: string; message?: string } | null = null;
          if (state.singleMode) {
            if (updatedRows.length === 0) {
              result = null;
              error = { code: 'PGRST116', message: 'No rows returned' };
            } else {
              result = updatedRows[0];
            }
          } else {
            result = updatedRows;
          }
          const response = { data: result, error };
          return Promise.resolve(response).then(onResolve);
        }),
        catch: jest.fn((onReject?: (error: any) => any) => {
          return Promise.resolve({ data: null, error: null }).catch(onReject);
        }),
        [Symbol.toStringTag]: 'Promise',
      };
      return updateBuilder;
    });

    builder.delete = jest.fn(() => {
      // Return a builder that supports .eq() chain after delete
      const deleteBuilder: any = {
        eq: jest.fn((field: string, value: any) => {
          state.filters.push({ field, operator: 'eq', value });
          return deleteBuilder;
        }),
        limit: jest.fn((count: number) => {
          state.limitCount = count;
          return deleteBuilder;
        }),
        then: jest.fn((onResolve?: (value: any) => any) => {
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
                  return (
                    Array.isArray(filter.value) &&
                    filter.value.includes(rowValue)
                  );
                default:
                  return true;
              }
            });
          }

          // Delete matching rows
          const allData = getTableData(table);
          const remainingData = allData.filter(
            (row: any) => !matchingRows.some((mr: any) => mr.id === row.id),
          );
          setTableData(table, remainingData);

          // Remove from documents
          matchingRows.forEach((row: any) => {
            mockDocuments.delete(`${table}:${row.id}`);
          });

          const response = {
            data: null,
            error: matchingRows.length === 0 ? { code: 'PGRST116' } : null,
          };
          return Promise.resolve(response).then(onResolve);
        }),
        catch: jest.fn((onReject?: (error: any) => any) => {
          return Promise.resolve({ data: null, error: null }).catch(onReject);
        }),
        [Symbol.toStringTag]: 'Promise',
      };
      return deleteBuilder;
    });

    // Make the builder thenable (Promise-like) by implementing then/catch
    // The promise is created lazily when then/catch is called
    const execute = () => {
      return executeQuery(
        table,
        state.filters,
        state.orderBy,
        state.limitCount,
        state.singleMode,
        state.selectFields,
        (state as any).countOptions,
        state,
      );
    };

    // Add promise methods to builder - these will be called when the query is awaited
    // Supabase queries always resolve with { data, error }, they never reject
    // Assign directly to preserve all other methods like limit, eq, etc.
    builder.then = jest.fn(
      (onResolve?: (value: any) => any, onReject?: (error: any) => any) => {
        const result = execute();
        // Always resolve, never reject - Supabase returns errors in the response object
        return Promise.resolve(result).then(onResolve, onReject);
      },
    );

    builder.catch = jest.fn((onReject?: (error: any) => any) => {
      const result = execute();
      // Always resolve, never reject
      return Promise.resolve(result).catch(onReject);
    });

    builder.finally = jest.fn((onFinally?: () => any) => {
      const result = execute();
      // Always resolve, never reject
      return Promise.resolve(result).finally(onFinally);
    });

    builder[Symbol.toStringTag] = 'Promise';

    return builder;
  };

  const fromMock = jest.fn((table: string) => createQueryBuilder(table));
  const mockClient = {
    from: fromMock,

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
      // Ensure from method still works after clearing
      fromMock.mockImplementation((table: string) => createQueryBuilder(table));
    },
  } as unknown as TestSupabaseClient;

  return mockClient;
}
