import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FIRESTORE } from '../config/firebase.provider';
import type { firestore } from 'firebase-admin';

const SYSTEM_USER_ID = 'system';

async function bootstrap() {
  console.log('🚀 Initializing NestJS application...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const firestore = app.get<firestore.Firestore>(FIRESTORE);

  try {
    // Get all system templates
    const templatesSnapshot = await firestore
      .collection('users')
      .doc(SYSTEM_USER_ID)
      .collection('kitTemplates')
      .get();

    console.log(`\n📋 Found ${templatesSnapshot.size} system templates\n`);

    for (const templateDoc of templatesSnapshot.docs) {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;

      console.log(`\n📦 Template: ${templateData.name} (ID: ${templateId})`);
      console.log(
        `   Path: users/${SYSTEM_USER_ID}/kitTemplates/${templateId}`,
      );

      // Check if template document exists
      const templateCheck = await firestore
        .collection('users')
        .doc(SYSTEM_USER_ID)
        .collection('kitTemplates')
        .doc(templateId)
        .get();

      if (!templateCheck.exists) {
        console.log(`   ❌ Template document does NOT exist!`);
        continue;
      }
      console.log(`   ✅ Template document exists`);

      // Check items subcollection
      const itemsSnapshot = await firestore
        .collection('users')
        .doc(SYSTEM_USER_ID)
        .collection('kitTemplates')
        .doc(templateId)
        .collection('kitItems')
        .get();

      console.log(`   📊 Items subcollection: ${itemsSnapshot.size} items`);

      if (itemsSnapshot.empty) {
        console.log(`   ❌ NO ITEMS FOUND in kitItems subcollection!`);
        console.log(
          `   Full path: users/${SYSTEM_USER_ID}/kitTemplates/${templateId}/kitItems`,
        );
      } else {
        console.log(`   ✅ Items found:`);
        itemsSnapshot.docs.forEach((itemDoc, idx) => {
          const itemData = itemDoc.data();
          console.log(
            `      ${idx + 1}. ${itemData.supplyName} (qty: ${itemData.quantity}, supplyId: ${itemData.supplyId})`,
          );
        });
      }

      // Check public template link
      const publicTemplates = await firestore
        .collection('publicKitTemplates')
        .where('publicTemplateId', '==', `${SYSTEM_USER_ID}/${templateId}`)
        .where('isActive', '==', true)
        .get();

      if (!publicTemplates.empty) {
        const publicTemplate = publicTemplates.docs[0];
        console.log(`   🔗 Linked to public template: ${publicTemplate.id}`);
      } else {
        console.log(`   ⚠️  No active public template linked`);
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
