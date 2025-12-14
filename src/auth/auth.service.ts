import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async createOrUpdateUser(
    firebaseUid: string,
    email: string,
    displayName?: string,
  ) {
    return this.usersService.createOrUpdateUser(
      firebaseUid,
      email,
      displayName,
    );
  }
}
