# Firebase Admin SDK Usage

## Current Usage

The `firebase-admin` package is still used in this project for **Firebase Cloud Messaging (FCM)** push notifications only.

### Push Notifications

**File**: `api/src/notifications/push-notification.service.ts`

Firebase Cloud Messaging (FCM) is used to send push notifications to iOS and Android devices. This is independent of the database migration - FCM can be used with Supabase as the database.

**Why keep it:**
- FCM is the standard for cross-platform push notifications
- Works with both iOS and Android
- No need to migrate to a different push notification service
- Can be used independently of Firestore

**Configuration:**
- FCM requires Firebase project credentials
- These should be stored in Secret Manager as `firebase-fcm-credentials-{env}`
- The service account JSON file is needed for FCM initialization

### Test Files

Some test files import `Timestamp` from `firebase-admin/firestore` for test data. This is acceptable as it's only used in tests, not production code.

## Future Considerations

If you want to remove Firebase entirely, consider:
- **Alternative push notification services**: OneSignal, Pusher, or native platform services
- **Migration effort**: Would require updating device token registration and notification sending logic

For now, keeping FCM is the simplest approach and doesn't conflict with the Supabase migration.
