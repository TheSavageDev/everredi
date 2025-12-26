import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { FIRESTORE } from '../config/firebase.provider';
import type { firestore } from 'firebase-admin';

const SYSTEM_USER_ID = 'system';
const logger = new Logger('VerifyTemplateItems');

async function bootstrap() {
  logger.log('🚀 Initializing NestJS application...');

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

    logger.log(`\n📋 Found ${templatesSnapshot.size} system templates\n`);

    for (const templateDoc of templatesSnapshot.docs) {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;

      logger.log(`\n📦 Template: ${templateData.name} (ID: ${templateId})`);
      logger.log(`   Path: users/${SYSTEM_USER_ID}/kitTemplates/${templateId}`);

      // Check if template document exists
      const templateCheck = await firestore
        .collection('users')
        .doc(SYSTEM_USER_ID)
        .collection('kitTemplates')
        .doc(templateId)
        .get();

      if (!templateCheck.exists) {
        logger.log(`   ❌ Template document does NOT exist!`);
        continue;
      }
      logger.log(`   ✅ Template document exists`);

      // Check items subcollection
      const itemsSnapshot = await firestore
        .collection('users')
        .doc(SYSTEM_USER_ID)
        .collection('kitTemplates')
        .doc(templateId)
        .collection('kitItems')
        .get();

      logger.log(`   📊 Items subcollection: ${itemsSnapshot.size} items`);

      if (itemsSnapshot.empty) {
        logger.log(`   ❌ NO ITEMS FOUND in kitItems subcollection!`);
        logger.log(
          `   Full path: users/${SYSTEM_USER_ID}/kitTemplates/${templateId}/kitItems`,
        );
      } else {
        logger.log(`   ✅ Items found:`);
        itemsSnapshot.docs.forEach((itemDoc, idx) => {
          const itemData = itemDoc.data();
          logger.log(
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
        logger.log(`   🔗 Linked to public template: ${publicTemplate.id}`);
      } else {
        logger.log(`   ⚠️  No active public template linked`);
      }
    }

    logger.log('\n✅ Verification complete');
    process.exit(0);
  } catch (error) {
    logger.error(
      '❌ Verification failed:',
      error instanceof Error ? error.stack : String(error),
    );
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
