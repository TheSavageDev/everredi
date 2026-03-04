import { ComplianceController } from '../compliance.controller';
import { ComplianceService } from '../compliance.service';

describe('ComplianceController', () => {
  let controller: ComplianceController;
  let complianceService: jest.Mocked<Partial<ComplianceService>>;

  beforeEach(() => {
    complianceService = {
      checkCompliance: jest.fn().mockResolvedValue({ compliant: true }),
      getComplianceChecks: jest.fn().mockResolvedValue([]),
      getComplianceCheck: jest.fn().mockResolvedValue({ id: 'check-1' }),
    };
    controller = new ComplianceController(complianceService as ComplianceService);
  });

  it('checkCompliance returns success with data', async () => {
    const result = await controller.checkCompliance(
      { uid: 'user-1' },
      { userKitId: 'kit-1' },
    );

    expect(complianceService.checkCompliance).toHaveBeenCalledWith(
      'user-1',
      'kit-1',
      undefined,
      undefined,
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ compliant: true });
  });

  it('getComplianceChecks returns list', async () => {
    const result = await controller.getComplianceChecks({ uid: 'user-1' });

    expect(complianceService.getComplianceChecks).toHaveBeenCalledWith('user-1');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('getComplianceCheck returns check when found', async () => {
    const result = await controller.getComplianceCheck(
      { uid: 'user-1' },
      'check-1',
    );

    expect(complianceService.getComplianceCheck).toHaveBeenCalledWith(
      'user-1',
      'check-1',
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'check-1' });
  });

  it('getComplianceCheck returns not found when null', async () => {
    (complianceService.getComplianceCheck as jest.Mock).mockResolvedValue(null);

    const result = await controller.getComplianceCheck(
      { uid: 'user-1' },
      'missing',
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});
