import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async createOrUpdateUser(
    userId: string,
    email: string,
    displayName?: string,
  ) {
    return this.usersService.createOrUpdateUser(userId, email, displayName);
  }
}
