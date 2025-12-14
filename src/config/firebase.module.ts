import { Module, Global } from '@nestjs/common';
import { ConfigModule } from './config.module';
import {
  firebaseAdminProvider,
  firestoreProvider,
  firebaseAuthProvider,
} from './firebase.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [firebaseAdminProvider, firestoreProvider, firebaseAuthProvider],
  exports: [firebaseAdminProvider, firestoreProvider, firebaseAuthProvider],
})
export class FirebaseModule {}
