import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

// Helper function to convert PostgreSQL row to SupportTicket
function rowToSupportTicket(row: any): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    message: row.message,
    priority: row.priority,
    status: row.status,
    isPremium: row.is_premium || false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    resolvedAt: row.resolved_at
      ? new Date(row.resolved_at)
      : undefined,
  };
}

@Injectable()
export class SupportService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async createTicket(
    userId: string,
    ticketData: Omit<
      SupportTicket,
      'id' | 'userId' | 'isPremium' | 'createdAt' | 'updatedAt' | 'status'
    >,
  ): Promise<SupportTicket> {
    const isPremium = await this.usersService.isPremiumUser(userId);
    const now = new Date();

    // Premium users get higher priority by default
    const priority = isPremium
      ? ticketData.priority === 'low'
        ? 'normal'
        : ticketData.priority
      : ticketData.priority;

    const { data, error } = await this.supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        subject: ticketData.subject,
        message: ticketData.message,
        priority,
        status: 'open',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create support ticket: ${error.message}`);
    }

    const ticket = rowToSupportTicket(data);
    return { ...ticket, isPremium };
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get support tickets: ${error.message}`);
    }

    // Get premium status for each ticket
    const isPremium = await this.usersService.isPremiumUser(userId);
    return (data || []).map((row) => ({
      ...rowToSupportTicket(row),
      isPremium,
    }));
  }

  async getTicket(
    userId: string,
    ticketId: string,
  ): Promise<SupportTicket | null> {
    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !data) {
      return null;
    }

    // Verify ticket belongs to user
    if (data.user_id !== userId) {
      return null;
    }

    const isPremium = await this.usersService.isPremiumUser(userId);
    return { ...rowToSupportTicket(data), isPremium };
  }

  async updateTicket(
    userId: string,
    ticketId: string,
    updates: Partial<Omit<SupportTicket, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<SupportTicket> {
    const ticket = await this.getTicket(userId, ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === 'resolved' || updates.status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    const { data, error } = await this.supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update support ticket: ${error.message}`);
    }

    const isPremium = await this.usersService.isPremiumUser(userId);
    return { ...rowToSupportTicket(data), isPremium };
  }
}
