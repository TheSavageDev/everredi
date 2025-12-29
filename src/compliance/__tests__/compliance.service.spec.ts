import { ComplianceService } from '../compliance.service';
import type { firestore } from 'firebase-admin';
import { UsersService } from '../../users/users.service';

describe('ComplianceService', () => {
  const firestoreMock = {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            docs: [],
          }),
          add: jest.fn().mockResolvedValue({
            id: 'check-1',
            get: jest.fn().mockResolvedValue({
              id: 'check-1',
              data: () => ({}),
            }),
          }),
        }),
      }),
    }),
  } as unknown as firestore.Firestore;

  const usersServiceMock = {
    getUserById: jest.fn(),
  } as unknown as UsersService;

  let service: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplianceService(firestoreMock, usersServiceMock);
  });

  it('returns an empty list of compliance checks for a new user', async () => {
    const checks = await service.getComplianceChecks('user-1');
    expect(Array.isArray(checks)).toBe(true);
  });
});
