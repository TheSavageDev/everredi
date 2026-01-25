import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupportService, SupportTicket } from './support.service';

@Controller('support')
@UseGuards(SupabaseAuthGuard, PremiumGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  async createTicket(
    @CurrentUser('uid') userId: string,
    @Body()
    body: {
      subject: string;
      message: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    },
  ) {
    const ticket = await this.supportService.createTicket(userId, {
      subject: body.subject,
      message: body.message,
      priority: body.priority || 'normal',
    });
    return {
      success: true,
      data: ticket,
      message: 'Support ticket created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tickets')
  async getTickets(@CurrentUser('uid') userId: string) {
    const tickets = await this.supportService.getTicketsByUser(userId);
    return {
      success: true,
      data: tickets,
      message: 'Support tickets retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tickets/:id')
  async getTicket(
    @CurrentUser('uid') userId: string,
    @Param('id') ticketId: string,
  ) {
    const ticket = await this.supportService.getTicket(userId, ticketId);
    if (!ticket) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: ticket,
      message: 'Support ticket retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('tickets/:id')
  async updateTicket(
    @CurrentUser('uid') userId: string,
    @Param('id') ticketId: string,
    @Body()
    body: Partial<{
      status: 'open' | 'in-progress' | 'resolved' | 'closed';
      priority: 'low' | 'normal' | 'high' | 'urgent';
    }>,
  ) {
    const ticket = await this.supportService.updateTicket(
      userId,
      ticketId,
      body as Partial<
        Omit<SupportTicket, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
      >,
    );
    return {
      success: true,
      data: ticket,
      message: 'Support ticket updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
