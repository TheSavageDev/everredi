import { ComplianceService } from '../compliance.service';
import type { firestore } from 'firebase-admin';

describe('ComplianceService', () => {
  const firestoreMock: Partial<firestore.Firestore> = {
    collection: jest.fn().mockReturnThis() as any,
    doc: jest.fn().mockReturnThis() as any,
    where: jest.fn().mockReturnThis() as any,
    orderBy: jest.fn().mockReturnThis() as any,
    limit: jest.fn().mockReturnThis() as any,
    get: jest.fn().mockResolvedValue({
      docs: [],
    }) as any,
    add: jest.fn().mockResolvedValue({
      id: 'check-1',
      get: jest.fn().mockResolvedValue({
        id: 'check-1',
        data: () => ({}),
      }),
    }) as any,
  };

  let service: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplianceService(firestoreMock as any);
  });

  it('returns an empty list of compliance checks for a new user', async () => {
    const checks = await service.getComplianceChecks('user-1');
    expect(Array.isArray(checks)).toBe(true);
  });
});
