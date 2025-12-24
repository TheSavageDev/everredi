import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
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
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly usersService: UsersService,
  ) {}

  async getLocations(userId: string): Promise<Location[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('locations')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Location[];
  }

  async getLocation(userId: string, locationId: string): Promise<Location> {
    const doc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('locations')
      .doc(locationId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException('Location not found');
    }

    return { id: doc.id, ...doc.data() } as Location;
  }

  async createLocation(
    userId: string,
    locationData: Omit<Location, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Location> {
    const isPremium = await this.usersService.isPremiumUser(userId);
    if (!isPremium) {
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('locations')
        .get();

      const count = snapshot.size;
      const maxFreeLocations = 2;

      if (count >= maxFreeLocations) {
        throw new ForbiddenException({
          code: 'LOCATION_LIMIT_REACHED',
          message:
            'You have reached the free limit of 2 locations. Upgrade to premium for unlimited locations.',
        });
      }
    }

    const now = Timestamp.now();
    const docRef = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('locations')
      .add({
        ...locationData,
        userId,
        createdAt: now,
        updatedAt: now,
      });

    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Location;
  }

  async updateLocation(
    userId: string,
    locationId: string,
    updates: Partial<Location>,
  ): Promise<Location> {
    const locationRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('locations')
      .doc(locationId);

    await locationRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const doc = await locationRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Location not found');
    }

    return { id: doc.id, ...doc.data() } as Location;
  }

  async deleteLocation(userId: string, locationId: string): Promise<void> {
    const locationRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('locations')
      .doc(locationId);

    const doc = await locationRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Location not found');
    }

    await locationRef.delete();
  }
}
