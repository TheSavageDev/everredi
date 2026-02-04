import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const MAX_MESSAGE_LENGTH = 5000;
const DEFAULT_SUPPORT_EMAIL = 'support@everredi.com';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;
  private readonly supportTo: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        'RESEND_API_KEY not set. Support contact and ticket notification emails will not be sent.',
      );
    }
    this.from =
      this.config.get<string>('EMAIL_FROM') ??
      'EverRedi <onboarding@resend.dev>';
    this.supportTo =
      this.config.get<string>('SUPPORT_EMAIL_TO') ?? DEFAULT_SUPPORT_EMAIL;
  }

  isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Send support contact form submission to support inbox.
   */
  async sendSupportContact(
    name: string,
    email: string,
    message: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Skipping sendSupportContact: Resend not configured');
      return;
    }

    const truncatedMessage =
      message.length > MAX_MESSAGE_LENGTH
        ? message.slice(0, MAX_MESSAGE_LENGTH) + '\n[... truncated]'
        : message;

    const subject = `EverRedi support request from ${name?.trim() || 'user'}`;
    const text = [
      truncatedMessage,
      '',
      '---',
      `Name: ${name?.trim() || '(not provided)'}`,
      `Email: ${email?.trim() || '(not provided)'}`,
    ].join('\n');

    try {
      await this.resend.emails.send({
        from: this.from,
        to: this.supportTo,
        subject,
        text,
      });
      this.logger.log('Support contact email sent');
    } catch (err) {
      this.logger.error(
        `Failed to send support contact email: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Send notification to support when an authenticated user creates a ticket.
   */
  async sendSupportTicketNotification(
    ticketId: string,
    subject: string,
    message: string,
    userEmail: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        'Skipping sendSupportTicketNotification: Resend not configured',
      );
      return;
    }

    const truncatedMessage =
      message.length > MAX_MESSAGE_LENGTH
        ? message.slice(0, MAX_MESSAGE_LENGTH) + '\n[... truncated]'
        : message;

    const emailSubject = `[Ticket ${ticketId}] ${subject}`;
    const text = [
      truncatedMessage,
      '',
      '---',
      `Ticket ID: ${ticketId}`,
      `From: ${userEmail}`,
    ].join('\n');

    try {
      await this.resend.emails.send({
        from: this.from,
        to: this.supportTo,
        subject: emailSubject,
        text,
      });
      this.logger.log(`Support ticket notification sent for ${ticketId}`);
    } catch (err) {
      this.logger.error(
        `Failed to send support ticket notification: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Do not rethrow - ticket was already created; email is best-effort
    }
  }

  /**
   * Send expiration notification email to the user.
   */
  async sendExpirationNotificationEmail(
    to: string,
    supplyName: string,
    daysUntilExpiration: number,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        'Skipping sendExpirationNotificationEmail: Resend not configured',
      );
      return;
    }

    const daysText =
      daysUntilExpiration === 1 ? '1 day' : `${daysUntilExpiration} days`;
    const subject = `EverRedi: ${supplyName} expires in ${daysText}`;
    const text = [
      `${supplyName} in your inventory will expire in ${daysText}.`,
      '',
      'Open the EverRedi app to view and manage your inventory.',
    ].join('\n');

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        text,
      });
      this.logger.log(`Expiration notification email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send expiration notification email: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Do not rethrow - push/in-app already sent; email is best-effort
    }
  }

  /**
   * Send low stock notification email to the user.
   */
  async sendLowStockNotificationEmail(
    to: string,
    supplyName: string,
    currentQuantity: number,
    minimumQuantity: number,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        'Skipping sendLowStockNotificationEmail: Resend not configured',
      );
      return;
    }

    const subject = `EverRedi: Low stock alert for ${supplyName}`;
    const text = [
      `Your inventory for "${supplyName}" is below your minimum.`,
      '',
      `Current quantity: ${currentQuantity}`,
      `Minimum quantity: ${minimumQuantity}`,
      '',
      'Open the EverRedi app to restock or adjust your alert.',
    ].join('\n');

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        text,
      });
      this.logger.log(`Low stock notification email sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send low stock notification email: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Do not rethrow - push/in-app sent; email is best-effort
    }
  }
}
