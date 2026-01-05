# RevenueCat Firebase Extension Setup Guide

This guide will help you set up the RevenueCat Firebase Extension to automatically sync subscription statuses from RevenueCat to Firestore.

## Prerequisites

1. **Firebase Project**: Must be on the Blaze (pay-as-you-go) plan
2. **RevenueCat Account**: Create a RevenueCat account and project
3. **Firestore Database**: Ensure Firestore is enabled in your Firebase project

## Step 1: Install the Firebase Extension

1. Navigate to the [RevenueCat Firebase Extension](https://extensions.dev/extensions/revenuecat/firestore-revenuecat-purchases) page
2. Click "Install in Firebase Console"
3. Select your Firebase project
4. Configure the extension with these settings:

   - **Cloud Functions Location**: Choose a region (e.g., `us-central1`)
   - **Firestore Collections**:
     - Events collection: `revenuecat_events`
     - Customers collection: `revenuecat_customers`
   - **Custom Claims**: Enable this option to set Firebase Auth custom claims with active entitlements
   - **Shared Secret**: You'll get this from RevenueCat (see Step 2)
   - **Enable Events**: Optional - enable if you want Eventarc events

5. Click "Install Extension"

## Step 2: Configure RevenueCat Integration

1. In the RevenueCat dashboard, go to your project settings
2. Navigate to **Integrations** → **Firebase**
3. Click "Add Integration" or "Configure"
4. Generate a **Shared Secret** (if not already generated)
5. Copy the **Webhook URL** from the Firebase Extension installation page
6. Paste the Webhook URL into RevenueCat's Firebase integration settings
7. Save the configuration

## Step 3: Update Firestore Security Rules

Add these rules to allow users to read their own RevenueCat data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // RevenueCat customers collection
    match /revenuecat_customers/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // Only extension can write
    }
    
    // RevenueCat events collection
    match /revenuecat_events/{eventId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.app_user_id;
      allow write: if false; // Only extension can write
    }
    
    // Your existing user collection rules...
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // ... rest of your rules
    }
  }
}
```

## Step 4: Configure RevenueCat App User ID

In your mobile app, ensure that RevenueCat's `appUserID` is set to the Firebase Auth UID:

```typescript
// In your RevenueCat initialization
await Purchases.configure({
  apiKey: RC_API_KEY,
  appUserID: firebaseUser.uid, // Use Firebase Auth UID
});
```

## Step 5: Verify the Integration

After setup, the extension will:

1. **Create documents** in `revenuecat_customers/{userId}` with subscription data
2. **Create events** in `revenuecat_events` for purchase lifecycle events
3. **Set custom claims** in Firebase Auth (if enabled) with active entitlements

### Check Firestore Collections

1. Go to Firebase Console → Firestore Database
2. Look for the `revenuecat_customers` collection
3. Documents should be created with user IDs matching Firebase Auth UIDs
4. Each document contains subscription and entitlement information

### Check Custom Claims (if enabled)

1. In Firebase Auth, check a user's custom claims
2. You should see `entitlements` with active entitlements like `everredi_pro`

## Data Structure

The extension creates documents with this structure:

### `revenuecat_customers/{userId}`

```typescript
{
  app_user_id: string; // Firebase Auth UID
  entitlements: {
    everredi_pro: {
      expires_date: string | null;
      product_identifier: string;
      purchase_date: string;
    };
    // ... other entitlements
  };
  subscriptions: {
    // ... subscription data
  };
  // ... other customer data
}
```

### `revenuecat_events/{eventId}`

```typescript
{
  app_user_id: string;
  event_type: string; // e.g., 'INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION'
  product_id: string;
  timestamp: string;
  // ... other event data
}
```

## Troubleshooting

### Extension Not Syncing Data

1. Check Cloud Functions logs in Firebase Console
2. Verify the shared secret matches in both RevenueCat and Firebase
3. Ensure the webhook URL is correctly configured in RevenueCat
4. Check that RevenueCat app user IDs match Firebase Auth UIDs

### Custom Claims Not Updating

1. Verify custom claims are enabled in extension configuration
2. Check Firebase Auth custom claims (may take a few minutes to propagate)
3. Users may need to refresh their auth token to see updated claims

### Firestore Rules Blocking Access

1. Verify security rules allow read access for authenticated users
2. Test rules in Firebase Console → Firestore → Rules → Rules Playground

## Next Steps

After the extension is set up, the backend will automatically:
- Read subscription status from `revenuecat_customers` collection
- Sync subscription data to user documents
- Handle subscription changes in real-time

No additional code changes are needed - the extension handles all the syncing automatically!

