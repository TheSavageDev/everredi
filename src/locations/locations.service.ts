import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
import { UsersService } from '../users/users.service';

export interface Location {
  id: string;
  userId: string;
  name: string;
  description?: string;
  locationType: 'home' | 'office' | 'vehicle' | 'backpack' | 'general';
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isPrimary: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class LocationsService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  async getLocations(userId: string): Promise<Location[]> {
    return this.firebaseService.getSubcollection<Location>(
      'users',
      userId,
      'locations',
    );
  }

  async getLocation(userId: string, locationId: string): Promise<Location> {
    const location =
      await this.firebaseService.getSubcollectionDocument<Location>(
        'users',
        userId,
        'locations',
        locationId,
        { throwIfNotFound: true },
      );

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  async createLocation(
    userId: string,
    locationData: Omit<Location, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Location> {
    const isPremium = await this.usersService.isPremiumUser(userId);
    if (!isPremium) {
      const locations = await this.firebaseService.getSubcollection(
        'users',
        userId,
        'locations',
      );

      const count = locations.length;
      const maxFreeLocations = 2;

      if (count >= maxFreeLocations) {
        throw new ForbiddenException({
          code: 'LOCATION_LIMIT_REACHED',
          message:
            'You have reached the free limit of 2 locations. Upgrade to premium for unlimited locations.',
        });
      }
    }

    return this.firebaseService.addSubcollectionDocument<Location>(
      'users',
      userId,
      'locations',
      {
        ...locationData,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    );
  }

  async updateLocation(
    userId: string,
    locationId: string,
    updates: Partial<Location>,
  ): Promise<Location> {
    return this.firebaseService.updateSubcollectionDocument<Location>(
      'users',
      userId,
      'locations',
      locationId,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deleteLocation(userId: string, locationId: string): Promise<void> {
    await this.firebaseService.deleteSubcollectionDocument(
      'users',
      userId,
      'locations',
      locationId,
    );
  }
}
