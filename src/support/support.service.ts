import { Injectable } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
import { UsersService } from '../users/users.service';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  isPremium: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly firebaseService: FirebaseService,
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
    const now = Timestamp.now();

    // Premium users get higher priority by default
    const priority = isPremium
      ? ticketData.priority === 'low'
        ? 'normal'
        : ticketData.priority
      : ticketData.priority;

    return this.firebaseService.addDocument<SupportTicket>('supportTickets', {
      userId,
      ...ticketData,
      priority,
      isPremium,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    return this.firebaseService.getCollection<SupportTicket>('supportTickets', {
      where: [{ field: 'userId', operator: '==', value: userId }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }

  async getTicket(
    userId: string,
    ticketId: string,
  ): Promise<SupportTicket | null> {
    const ticket = await this.firebaseService.getDocument<SupportTicket>(
      'supportTickets',
      ticketId,
    );

    if (!ticket) {
      return null;
    }

    // Verify ticket belongs to user
    if (ticket.userId !== userId) {
      return null;
    }

    return ticket;
  }

  async updateTicket(
    userId: string,
    ticketId: string,
    updates: Partial<Omit<SupportTicket, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<SupportTicket> {
    const ticket = await this.getTicket(userId, ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const updateData: Partial<SupportTicket> = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    if (updates.status === 'resolved' || updates.status === 'closed') {
      updateData.resolvedAt = Timestamp.now();
    }

    return this.firebaseService.updateDocument<SupportTicket>(
      'supportTickets',
      ticketId,
      updateData,
    );
  }
}
