import { Module, Global } from '@nestjs/common';
import { ConfigModule } from './config.module';
import { UsersModule } from '../users/users.module';
import {
  FirebaseApp,
  firestoreProvider,
  firebaseAuthProvider,
  FIRESTORE,
  FIREBASE_AUTH,
} from './firebase.provider';
import { FirebaseService } from './firebase.service';
import { FirebaseController } from './firebase.controller';

@Global()
@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [FirebaseController],
  providers: [
    FirebaseApp,
    firestoreProvider,
    firebaseAuthProvider,
    FirebaseService,
  ],
  exports: [FirebaseApp, FIRESTORE, FIREBASE_AUTH, FirebaseService],
})
export class FirebaseModule {}
