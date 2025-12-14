import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FIRESTORE } from '../config/firebase.provider';
import type { firestore } from 'firebase-admin';

async function bootstrap() {
  console.log('🚀 Initializing NestJS application...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const firestore = app.get<firestore.Firestore>(FIRESTORE);

  try {
    // Get all active public templates
    const templatesSnapshot = await firestore
      .collection('publicKitTemplates')
      .where('isActive', '==', true)
      .get();

    console.log(
      `\n📋 Found ${templatesSnapshot.size} active public templates\n`,
    );

    for (const templateDoc of templatesSnapshot.docs) {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;

      console.log(`\n📦 Template: ${templateData.name} (ID: ${templateId})`);
      console.log(`   Path: publicKitTemplates/${templateId}`);

      // Check items subcollection
      const itemsSnapshot = await firestore
        .collection('publicKitTemplates')
        .doc(templateId)
        .collection('kitItems')
        .get();

      console.log(`   📊 Items subcollection: ${itemsSnapshot.size} items`);

      if (itemsSnapshot.empty) {
        console.log(`   ❌ NO ITEMS FOUND in kitItems subcollection!`);
        console.log(`   Full path: publicKitTemplates/${templateId}/kitItems`);
      } else {
        console.log(`   ✅ Items found:`);
        itemsSnapshot.docs.forEach((itemDoc, idx) => {
          const itemData = itemDoc.data();
          console.log(
            `      ${idx + 1}. ${itemData.supplyName} (qty: ${itemData.quantity}, supplyId: ${itemData.supplyId})`,
          );
        });
      }
    }

    console.log('\n✅ Verification complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
