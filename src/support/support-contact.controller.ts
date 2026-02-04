import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../email/email.service';

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

@Controller('support')
export class SupportContactController {
  constructor(private readonly emailService: EmailService) {}

  @Post('contact')
  @HttpCode(HttpStatus.OK)
  @Throttle({ contact: { limit: 5, ttl: 3600000 } })
  async contact(
    @Body()
    body: {
      name?: string;
      email?: string;
      message?: string;
    },
  ) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
      throw new BadRequestException('Message is required');
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message must be at most ${MAX_MESSAGE_LENGTH} characters`,
      );
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new BadRequestException(
        `Name must be at most ${MAX_NAME_LENGTH} characters`,
      );
    }
    if (email.length > MAX_EMAIL_LENGTH) {
      throw new BadRequestException(
        `Email must be at most ${MAX_EMAIL_LENGTH} characters`,
      );
    }
    if (email && !EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    await this.emailService.sendSupportContact(name, email, message);

    return {
      success: true,
      message: 'Message sent',
      timestamp: new Date().toISOString(),
    };
  }
}
