import { ComplianceService } from '../compliance.service';
import { UsersService } from '../../users/users.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { SUPABASE } from '../../config/supabase.provider';

describe('ComplianceService', () => {
  const supabaseMock = createSupabaseClientMock();
  const usersServiceMock = {
    getUserById: jest.fn(),
  } as unknown as UsersService;

  let service: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new ComplianceService(supabaseMock, usersServiceMock);
  });

  it('returns an empty list of compliance checks for a new user', async () => {
    // Mock empty compliance checks
    (supabaseMock._setMockData as jest.Mock)('compliance_checks', []);

    const checks = await service.getComplianceChecks('user-1');
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBe(0);
  });
});
