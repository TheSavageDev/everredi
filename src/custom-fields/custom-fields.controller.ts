import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CustomFieldsService,
  CustomFieldDefinition,
} from './custom-fields.service';

@Controller('custom-fields')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  async getCustomFields(@CurrentUser('uid') userId: string) {
    const fields = await this.customFieldsService.getCustomFields(userId);
    return {
      success: true,
      data: fields,
      message: 'Custom fields retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createCustomField(
    @CurrentUser('uid') userId: string,
    @Body()
    body: {
      name: string;
      type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
      required?: boolean;
      options?: string[];
      order?: number;
    },
  ) {
    // Get max order if order not provided
    const order =
      body.order !== undefined
        ? body.order
        : (await this.customFieldsService.getCustomFields(userId)).reduce(
            (max, field) => Math.max(max, field.order || 0),
            0,
          ) + 1;

    const field = await this.customFieldsService.createCustomField(userId, {
      name: body.name,
      type: body.type,
      required: body.required ?? false,
      options: body.options,
      order,
    });
    return {
      success: true,
      data: field,
      message: 'Custom field created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  async updateCustomField(
    @CurrentUser('uid') userId: string,
    @Param('id') fieldId: string,
    @Body()
    body: Partial<{
      name: string;
      type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
      required: boolean;
      options: string[];
      order: number;
    }>,
  ) {
    const field = await this.customFieldsService.updateCustomField(
      userId,
      fieldId,
      body as Partial<
        Omit<CustomFieldDefinition, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
      >,
    );
    return {
      success: true,
      data: field,
      message: 'Custom field updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteCustomField(
    @CurrentUser('uid') userId: string,
    @Param('id') fieldId: string,
  ) {
    await this.customFieldsService.deleteCustomField(userId, fieldId);
    return {
      success: true,
      message: 'Custom field deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reorder')
  async reorderFields(
    @CurrentUser('uid') userId: string,
    @Body() body: { fieldIds: string[] },
  ) {
    await this.customFieldsService.reorderFields(userId, body.fieldIds);
    return {
      success: true,
      message: 'Custom fields reordered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
