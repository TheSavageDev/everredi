import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { FIRESTORE } from '../config/firebase.provider';
import type { firestore } from 'firebase-admin';

const logger = new Logger('VerifyPublicTemplateItems');

async function bootstrap() {
  logger.log('🚀 Initializing NestJS application...');

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

    logger.log(
      `\n📋 Found ${templatesSnapshot.size} active public templates\n`,
    );

    for (const templateDoc of templatesSnapshot.docs) {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;

      logger.log(`\n📦 Template: ${templateData.name} (ID: ${templateId})`);
      logger.log(`   Path: publicKitTemplates/${templateId}`);

      // Check items subcollection
      const itemsSnapshot = await firestore
        .collection('publicKitTemplates')
        .doc(templateId)
        .collection('kitItems')
        .get();

      logger.log(`   📊 Items subcollection: ${itemsSnapshot.size} items`);

      if (itemsSnapshot.empty) {
        logger.log(`   ❌ NO ITEMS FOUND in kitItems subcollection!`);
        logger.log(`   Full path: publicKitTemplates/${templateId}/kitItems`);
      } else {
        logger.log(`   ✅ Items found:`);
        itemsSnapshot.docs.forEach((itemDoc, idx) => {
          const itemData = itemDoc.data();
          logger.log(
            `      ${idx + 1}. ${itemData.supplyName} (qty: ${itemData.quantity}, supplyId: ${itemData.supplyId})`,
          );
        });
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
