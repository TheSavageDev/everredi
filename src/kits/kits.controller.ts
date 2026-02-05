import { appendFileSync } from 'fs';
import { join } from 'path';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KitTemplatesService, KitTemplate } from './kit-templates.service';
import { UserKitsService, UserKit } from './user-kits.service';
import { PublicTemplatesService } from './public-templates.service';
import { CreateUserKitFromTemplateDto } from './dto/create-user-kit-from-template.dto';

@Controller('kits')
@UseGuards(SupabaseAuthGuard)
export class KitsController {
  private readonly logger = new Logger(KitsController.name);

  constructor(
    private readonly templatesService: KitTemplatesService,
    private readonly userKitsService: UserKitsService,
  ) {}

  // Kit Templates
  @Get()
  async getKitTemplates(@CurrentUser() user: { uid: string }) {
    const templates = await this.templatesService.getKitTemplates(user.uid);
    return {
      success: true,
      data: templates,
      message: 'Kit templates retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/items')
  async getTemplateItems(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Query('peopleCount') peopleCount?: string,
  ) {
    const selectedPeopleCount = peopleCount
      ? parseInt(peopleCount, 10)
      : undefined;
    const items = await this.templatesService.getTemplateItems(
      user.uid,
      id,
      selectedPeopleCount,
    );
    return {
      success: true,
      data: items,
      message: 'Template items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createKitTemplate(
    @CurrentUser() user: { uid: string },
    @Body() templateData: Record<string, unknown>,
  ) {
    const template = await this.templatesService.createKitTemplate(
      user.uid,
      templateData as unknown as Omit<
        KitTemplate,
        'id' | 'updatedAt' | 'createdAt' | 'userId'
      >,
    );
    return {
      success: true,
      data: template,
      message: 'Kit template created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getKitTemplate(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const template = await this.templatesService.getKitTemplate(user.uid, id);
    return {
      success: true,
      data: template,
      message: 'Kit template retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id/items')
  async saveTemplateItems(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body()
    body: {
      items: Array<{
        supplyId: string;
        supplyName?: string;
        requiredQuantity: number;
        notes?: string;
        sortOrder?: number;
      }>;
    },
  ) {
    await this.templatesService.saveTemplateItems(
      user.uid,
      id,
      body.items ?? [],
    );
    return {
      success: true,
      message: 'Template items saved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async updateKitTemplate(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body() updates: Record<string, unknown>,
  ) {
    const template = await this.templatesService.updateKitTemplate(
      user.uid,
      id,
      updates,
    );
    return {
      success: true,
      data: template,
      message: 'Kit template updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteKitTemplate(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    await this.templatesService.deleteKitTemplate(user.uid, id);
    return {
      success: true,
      message: 'Kit template deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('user-kits')
@UseGuards(SupabaseAuthGuard)
export class UserKitsController {
  private readonly logger = new Logger(UserKitsController.name);

  constructor(
    private readonly userKitsService: UserKitsService,
    private readonly templatesService: KitTemplatesService,
    private readonly publicTemplatesService: PublicTemplatesService,
  ) {}

  @Get()
  async getUserKits(@CurrentUser() user: { uid: string }) {
    const kits = await this.userKitsService.getUserKits(user.uid);
    return {
      success: true,
      data: kits,
      message: 'User kits retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createUserKit(
    @CurrentUser() user: { uid: string },
    @Body() kitData: Record<string, unknown>,
  ) {
    const kit = await this.userKitsService.createUserKit(
      user.uid,
      kitData as unknown as Omit<
        UserKit,
        'id' | 'userId' | 'createdAt' | 'updatedAt'
      >,
    );
    return {
      success: true,
      data: kit,
      message: 'User kit created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('from-template')
  async createUserKitFromTemplate(
    @CurrentUser() user: { uid: string },
    @Body(
      new ValidationPipe({
        whitelist: false,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    )
    body: CreateUserKitFromTemplateDto,
  ) {
    this.logger.warn(
      `[FROM-TEMPLATE] *** ENDPOINT HIT *** templateId=${body.templateId}, includeItems=${body.includeItems}, isPublicTemplate=${body.isPublicTemplate}`,
    );
    this.logger.log(
      `Creating kit from template: ${body.templateId}, isPublicTemplate: ${body.isPublicTemplate}, includeItems: ${body.includeItems}`,
    );
    const bodyRecord = body as unknown as Record<string, unknown>;
    const receivedKeys = Object.keys(bodyRecord);
    this.logger.log(
      `[FROM-TEMPLATE] body keys: ${receivedKeys.join(', ')}, templateItems type=${typeof bodyRecord.templateItems}, isArray=${Array.isArray(bodyRecord.templateItems)}, length=${(bodyRecord.templateItems as unknown[])?.length ?? 'n/a'}`,
    );

    // #region agent log
    try {
      const logLine =
        JSON.stringify({
          location: 'kits.controller.ts:createUserKitFromTemplate',
          message: 'Backend received body',
          data: {
            includeItems: body.includeItems,
            templateItemsLength: body.templateItems?.length ?? -1,
            templateItemsIsArray: Array.isArray(body.templateItems),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'H4',
        }) + '\n';
      const paths = [
        join(process.cwd(), '.cursor', 'debug.log'),
        join(process.cwd(), '..', '.cursor', 'debug.log'),
        '/Users/jasonsavage/projects/.cursor/debug.log',
      ];
      for (const logPath of paths) {
        try {
          appendFileSync(logPath, logLine);
          break;
        } catch (_) {}
      }
    } catch (_) {}
    // #endregion

    type TemplateItem = {
      supplyId: string;
      supplyName?: string;
      requiredQuantity: number;
      notes?: string;
    };

    let templateItems: TemplateItem[];

    const resolveFromBackend = async (): Promise<TemplateItem[]> => {
      if (body.isPublicTemplate) {
        const publicItems =
          await this.publicTemplatesService.getPublicTemplateItems(
            body.templateId,
            body.selectedPeopleCount,
          );
        this.logger.log(
          `[FROM-TEMPLATE] Fallback: retrieved ${publicItems.length} items from public template ${body.templateId}`,
        );
        return publicItems.map((item) => ({
          supplyId: item.supplyId ?? '',
          supplyName: item.supplyName,
          requiredQuantity: item.quantity,
          notes: item.notes,
        }));
      } else {
        const items = await this.templatesService.getTemplateItems(
          user.uid,
          body.templateId,
          body.selectedPeopleCount,
        );
        this.logger.log(
          `[FROM-TEMPLATE] Fallback: retrieved ${items.length} items from user template ${body.templateId}`,
        );
        return items;
      }
    };

    const rawBody = body as unknown as Record<string, unknown>;
    const bodyItemsRaw = Array.isArray(body.templateItems)
      ? body.templateItems
      : Array.isArray(rawBody.template_items)
        ? rawBody.template_items
        : [];
    const bodyItems: TemplateItem[] = bodyItemsRaw.map(
      (item: Record<string, unknown>) => ({
        supplyId: String(item.supplyId ?? item.supply_id ?? ''),
        supplyName: (item.supplyName ?? item.supply_name) as string | undefined,
        requiredQuantity: Number(
          item.requiredQuantity ?? item.required_quantity ?? 0,
        ),
        notes: (item.notes as string | undefined) ?? undefined,
      }),
    );

    if (body.includeItems && bodyItems.length > 0) {
      templateItems = bodyItems;
      this.logger.log(
        `[FROM-TEMPLATE] Using ${templateItems.length} template items from request body`,
      );
    } else if (body.includeItems) {
      try {
        templateItems = await resolveFromBackend();
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `[FROM-TEMPLATE] Fallback failed: ${errMsg}`,
          error instanceof Error ? error.stack : undefined,
        );
        templateItems = [];
      }
    } else {
      try {
        templateItems = await resolveFromBackend();
      } catch {
        templateItems = [];
      }
    }

    this.logger.log(
      `Template items to create: ${templateItems?.length || 0}, first item: ${JSON.stringify(templateItems?.[0] || null)}`,
    );

    // #region agent log
    try {
      const logLine =
        JSON.stringify({
          location: 'kits.controller.ts:afterResolveTemplateItems',
          message: 'Template items resolved',
          data: { templateItemsLength: templateItems?.length ?? -1 },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'H5',
        }) + '\n';
      const paths = [
        join(process.cwd(), '.cursor', 'debug.log'),
        join(process.cwd(), '..', '.cursor', 'debug.log'),
        '/Users/jasonsavage/projects/.cursor/debug.log',
      ];
      for (const logPath of paths) {
        try {
          appendFileSync(logPath, logLine);
          break;
        } catch (_) {}
      }
    } catch (_) {}
    // #endregion

    const kit = await this.userKitsService.createUserKitFromTemplate(
      user.uid,
      body.templateId,
      body.templateName,
      body.locationId,
      body.locationName,
      body.includeItems,
      templateItems,
    );

    const itemCount = templateItems?.length || 0;
    let message = `User kit created successfully`;
    if (itemCount > 0) {
      if (body.includeItems) {
        message += ` with ${itemCount} item${itemCount === 1 ? '' : 's'} (fully loaded)`;
      } else {
        message += ` with ${itemCount} item${itemCount === 1 ? '' : 's'} (empty - quantities set to 0)`;
      }
    } else {
      message += ` as empty (template has no items)`;
    }

    return {
      success: true,
      data: kit,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getUserKit(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const kit = await this.userKitsService.getUserKit(user.uid, id);
    return {
      success: true,
      data: kit,
      message: 'User kit retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/items')
  async getkitItems(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const items = await this.userKitsService.getkitItems(user.uid, id);
    return {
      success: true,
      data: items,
      message: 'Kit items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/items')
  async createKitItemInstance(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body() itemData: any,
  ) {
    const item = await this.userKitsService.createKitItemInstance(
      user.uid,
      id,
      itemData,
    );
    return {
      success: true,
      data: item,
      message: 'Kit item created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id/items/:itemId')
  async updateKitItemInstance(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body()
    updates: {
      actualQuantity?: number;
      supplyName?: string;
      requiredQuantity?: number;
      notes?: string;
    },
  ) {
    const item = await this.userKitsService.updateKitItemInstance(
      user.uid,
      id,
      itemId,
      updates,
    );
    return {
      success: true,
      data: item,
      message: 'Kit item updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/items/:itemId/move')
  async moveKitItemInstance(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { targetKitId: string },
  ) {
    const item = await this.userKitsService.moveKitItemInstance(
      user.uid,
      id,
      itemId,
      body.targetKitId,
    );
    return {
      success: true,
      data: item,
      message: 'Kit item moved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id/items/:itemId')
  async deleteKitItemInstance(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    await this.userKitsService.deleteKitItemInstance(user.uid, id, itemId);
    return {
      success: true,
      message: 'Kit item deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/items/bulk-update-to-required')
  async bulkUpdateKitItemsToRequiredQuantity(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const result =
      await this.userKitsService.bulkUpdateKitItemsToRequiredQuantity(
        user.uid,
        id,
      );
    return {
      success: true,
      data: result,
      message: `Updated ${result.updated} item${result.updated === 1 ? '' : 's'} to required quantity`,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async updateUserKit(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    const kit = await this.userKitsService.updateUserKit(user.uid, id, updates);
    return {
      success: true,
      data: kit,
      message: 'User kit updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/compliance/check')
  async checkKitCompliance(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const kit = await this.userKitsService.getUserKit(user.uid, id);
    if (!kit.isOshaKit || !kit.oshaKitType) {
      return {
        success: false,
        error: {
          code: 'NOT_OSHA_KIT',
          message: 'This kit is not designated as an OSHA kit',
        },
        timestamp: new Date().toISOString(),
      };
    }

    await this.userKitsService.recalculateCompliance(
      user.uid,
      id,
      kit.oshaKitType,
    );

    // Reload kit to get updated compliance data
    const updatedKit = await this.userKitsService.getUserKit(user.uid, id);

    return {
      success: true,
      data: {
        complianceStatus: updatedKit.complianceStatus,
        complianceScore: updatedKit.complianceScore,
        lastComplianceCheckAt: updatedKit.lastComplianceCheckAt,
        complianceMetadata: updatedKit.complianceMetadata,
      },
      message: 'Compliance check completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/compliance')
  async getKitCompliance(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const kit = await this.userKitsService.getUserKit(user.uid, id);
    if (!kit.isOshaKit) {
      return {
        success: false,
        error: {
          code: 'NOT_OSHA_KIT',
          message: 'This kit is not designated as an OSHA kit',
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: {
        complianceStatus: kit.complianceStatus,
        complianceScore: kit.complianceScore,
        lastComplianceCheckAt: kit.lastComplianceCheckAt,
        complianceMetadata: kit.complianceMetadata,
        oshaKitType: kit.oshaKitType,
        oshaRuleId: kit.oshaRuleId,
      },
      message: 'Compliance status retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteUserKit(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Query('keepItems') keepItems?: string,
  ) {
    const keepItemsOption =
      keepItems === 'true' || keepItems === '1' ? true : undefined;
    await this.userKitsService.deleteUserKit(user.uid, id, {
      keepItems: keepItemsOption,
    });
    return {
      success: true,
      message: 'User kit deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('public-templates')
@UseGuards(SupabaseAuthGuard)
export class PublicTemplatesController {
  constructor(
    private readonly publicTemplatesService: PublicTemplatesService,
  ) {}

  @Get()
  async getPublicTemplates(
    @CurrentUser() user: { uid: string },
    @Query('purpose') purpose?: string,
    @Query('skillLevel') skillLevel?: string,
  ) {
    const templates = await this.publicTemplatesService.getPublicTemplates(
      purpose,
      skillLevel,
      user?.uid,
    );
    return {
      success: true,
      data: templates,
      message: 'Public templates retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/items')
  async getPublicTemplateItems(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Query('peopleCount') peopleCount?: string,
  ) {
    const selectedPeopleCount = peopleCount
      ? parseInt(peopleCount, 10)
      : undefined;
    const items = await this.publicTemplatesService.getPublicTemplateItems(
      id,
      selectedPeopleCount,
      user?.uid,
    );
    return {
      success: true,
      data: items,
      message: 'Public template items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  // Admin endpoints for managing public templates
  @Post()
  @UseGuards(AdminGuard)
  async createPublicTemplate(
    @CurrentUser() user: { uid: string },
    @Body() templateData: any,
  ) {
    const template = await this.publicTemplatesService.createPublicTemplate({
      ...templateData,
      createdBy: user.uid,
    });
    return {
      success: true,
      data: template,
      message: 'Public template created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  async updatePublicTemplate(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    const template = await this.publicTemplatesService.updatePublicTemplate(
      id,
      updates,
    );
    return {
      success: true,
      data: template,
      message: 'Public template updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async deletePublicTemplate(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    await this.publicTemplatesService.deletePublicTemplate(id);
    return {
      success: true,
      message: 'Public template deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
