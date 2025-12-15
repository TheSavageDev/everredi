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
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KitTemplatesService } from './kit-templates.service';
import { UserKitsService } from './user-kits.service';
import { PublicTemplatesService } from './public-templates.service';

@Controller('kits')
@UseGuards(FirebaseAuthGuard)
export class KitsController {
  constructor(
    private readonly templatesService: KitTemplatesService,
    private readonly userKitsService: UserKitsService,
  ) {}

  // Kit Templates
  @Get()
  async getKitTemplates(@CurrentUser() user: any) {
    const templates = await this.templatesService.getKitTemplates(user.uid);
    return {
      success: true,
      data: templates,
      message: 'Kit templates retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createKitTemplate(@CurrentUser() user: any, @Body() templateData: any) {
    const template = await this.templatesService.createKitTemplate(
      user.uid,
      templateData,
    );
    return {
      success: true,
      data: template,
      message: 'Kit template created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getKitTemplate(@CurrentUser() user: any, @Param('id') id: string) {
    const template = await this.templatesService.getKitTemplate(user.uid, id);
    return {
      success: true,
      data: template,
      message: 'Kit template retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async updateKitTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updates: any,
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
  async deleteKitTemplate(@CurrentUser() user: any, @Param('id') id: string) {
    await this.templatesService.deleteKitTemplate(user.uid, id);
    return {
      success: true,
      message: 'Kit template deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('user-kits')
@UseGuards(FirebaseAuthGuard)
export class UserKitsController {
  constructor(
    private readonly userKitsService: UserKitsService,
    private readonly templatesService: KitTemplatesService,
    private readonly publicTemplatesService: PublicTemplatesService,
  ) {}

  @Get()
  async getUserKits(@CurrentUser() user: any) {
    const kits = await this.userKitsService.getUserKits(user.uid);
    return {
      success: true,
      data: kits,
      message: 'User kits retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createUserKit(@CurrentUser() user: any, @Body() kitData: any) {
    const kit = await this.userKitsService.createUserKit(user.uid, kitData);
    return {
      success: true,
      data: kit,
      message: 'User kit created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('from-template')
  async createUserKitFromTemplate(
    @CurrentUser() user: any,
    @Body()
    body: {
      templateId: string;
      templateName: string;
      locationId: string;
      locationName?: string;
      includeItems: boolean;
      isPublicTemplate?: boolean;
    },
  ) {
    // Always get template items (for both empty and fully loaded kits)
    let templateItems:
      | Array<{
          supplyId: string;
          supplyName?: string;
          quantity: number;
          notes?: string;
        }>
      | undefined;

    if (body.isPublicTemplate) {
      // For public templates, get items directly from the public template
      try {
        templateItems =
          await this.publicTemplatesService.getPublicTemplateItems(
            body.templateId,
          );
        console.log(
          `Found ${templateItems.length} items in public template ${body.templateId}`,
        );
      } catch (error: any) {
        console.warn(
          'Failed to get items from public template:',
          error.message,
        );
        templateItems = [];
      }
    } else {
      // For user templates, get items from the template
      try {
        templateItems = await this.templatesService.getTemplateItems(
          user.uid,
          body.templateId,
        );
        console.log(
          `Found ${templateItems.length} items in user template ${body.templateId} for user ${user.uid}`,
        );
      } catch (error: any) {
        console.error(
          `Failed to get template items for template ${body.templateId}:`,
          error.message,
        );
        templateItems = [];
      }
    }

    // Warn if template has no items
    if (!templateItems || templateItems.length === 0) {
      console.warn(
        `Template ${body.templateId} has no items. Creating kit without items.`,
      );
    }

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
  async getUserKit(@CurrentUser() user: any, @Param('id') id: string) {
    const kit = await this.userKitsService.getUserKit(user.uid, id);
    return {
      success: true,
      data: kit,
      message: 'User kit retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/items')
  async getkitItems(@CurrentUser() user: any, @Param('id') id: string) {
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
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
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

  @Put(':id')
  async updateUserKit(
    @CurrentUser() user: any,
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

  @Delete(':id')
  async deleteUserKit(@CurrentUser() user: any, @Param('id') id: string) {
    await this.userKitsService.deleteUserKit(user.uid, id);
    return {
      success: true,
      message: 'User kit deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('public-templates')
@UseGuards(FirebaseAuthGuard)
export class PublicTemplatesController {
  constructor(
    private readonly publicTemplatesService: PublicTemplatesService,
  ) {}

  @Get()
  async getPublicTemplates(
    @Query('purpose') purpose?: string,
    @Query('skillLevel') skillLevel?: string,
  ) {
    const templates = await this.publicTemplatesService.getPublicTemplates(
      purpose,
      skillLevel,
    );
    return {
      success: true,
      data: templates,
      message: 'Public templates retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  // Admin endpoints for managing public templates
  @Post()
  async createPublicTemplate(
    @CurrentUser() user: any,
    @Body() templateData: any,
  ) {
    // TODO: Add admin check in production
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
  async updatePublicTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    // TODO: Add admin check in production
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
  async deletePublicTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    // TODO: Add admin check in production
    await this.publicTemplatesService.deletePublicTemplate(id);
    return {
      success: true,
      message: 'Public template deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
