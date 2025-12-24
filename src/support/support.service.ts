import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
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
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
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

    const ticketRef = await this.firestore.collection('supportTickets').add({
      userId,
      ...ticketData,
      priority,
      isPremium,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });

    const ticketDoc = await ticketRef.get();
    return {
      id: ticketDoc.id,
      userId,
      isPremium,
      ...ticketDoc.data(),
    } as SupportTicket;
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    const snapshot = await this.firestore
      .collection('supportTickets')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      userId,
      ...doc.data(),
    })) as SupportTicket[];
  }

  async getTicket(
    userId: string,
    ticketId: string,
  ): Promise<SupportTicket | null> {
    const doc = await this.firestore
      .collection('supportTickets')
      .doc(ticketId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const ticket = { id: doc.id, ...doc.data() } as SupportTicket;

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

    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    if (updates.status === 'resolved' || updates.status === 'closed') {
      updateData.resolvedAt = Timestamp.now();
    }

    await this.firestore
      .collection('supportTickets')
      .doc(ticketId)
      .update(updateData);

    const updatedDoc = await this.firestore
      .collection('supportTickets')
      .doc(ticketId)
      .get();
    return { id: updatedDoc.id, userId, ...updatedDoc.data() } as SupportTicket;
  }
}


