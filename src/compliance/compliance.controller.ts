import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ComplianceService } from './compliance.service';

@Controller('compliance')
@UseGuards(FirebaseAuthGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('check')
  async checkCompliance(
    @CurrentUser() user: any,
    @Body() body: { userKitId: string; oshaRuleId?: string; industry?: string },
  ) {
    const check = await this.complianceService.checkCompliance(
      user.uid,
      body.userKitId,
      body.oshaRuleId,
      body.industry,
    );
    return {
      success: true,
      data: check,
      message: 'Compliance check completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('checks')
  async getComplianceChecks(@CurrentUser() user: any) {
    const checks = await this.complianceService.getComplianceChecks(user.uid);
    return {
      success: true,
      data: checks,
      message: 'Compliance checks retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('checks/:id')
  async getComplianceCheck(@CurrentUser() user: any, @Param('id') id: string) {
    const check = await this.complianceService.getComplianceCheck(user.uid, id);
    if (!check) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Compliance check not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: check,
      message: 'Compliance check retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
