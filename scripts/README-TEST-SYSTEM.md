# System Test Script

The `test-system.ts` script provides comprehensive end-to-end testing of the entire API.

## Prerequisites

1. **API Server Running**: The API must be running (e.g., `npm run start:dev`)
2. **Firebase Auth Token**: You need a valid Firebase authentication token

## Getting a Firebase Auth Token

### Option 1: Using the Web App (Easiest)

1. Start the web app: `cd web && npm run dev`
2. Open `http://localhost:3000` in your browser
3. Sign in with a test account (or create one)
4. Open browser DevTools → Console (F12)
5. Run this command:

   ```javascript
   const auth = await import('firebase/auth');
   const { getAuth } = auth;
   const { getIdToken } = auth;
   // Get the current user's token
   const user = getAuth().currentUser;
   if (user) {
     const token = await getIdToken(user);
     console.log('Your token:', token);
     // Copy this token
   } else {
     console.log('Not signed in');
   }
   ```

   Or simpler, if you have Firebase available globally:

   ```javascript
   await firebase
     .auth()
     .currentUser.getIdToken()
     .then((token) => console.log(token));
   ```

6. Copy the token and use it as `TEST_AUTH_TOKEN`

### Option 2: Using the Helper Script

```bash
# This creates a custom token (you still need to exchange it for ID token)
npm run get-token test@example.com
```

### Option 3: Check Token Validity

If you're getting 401 errors, your token might be:

- Expired (Firebase ID tokens expire after 1 hour)
- Invalid format
- From wrong Firebase project

**Solution**: Get a fresh token using Option 1 above.

## Configuration

You can set the auth token in multiple ways:

### Option 1: Environment Variable (Recommended)

```bash
export TEST_AUTH_TOKEN=your_firebase_id_token_here
npm run test:system
```

### Option 2: .env File

Add to `api/.env`:

```env
# API URL (default: http://localhost:5051/api)
API_URL=http://localhost:5051/api

# Firebase Auth Token (required)
TEST_AUTH_TOKEN=your_firebase_id_token_here

# Optional: Clean up test data after tests
CLEANUP_TEST_DATA=true
```

### Option 3: Command Line Argument

```bash
npm run test:system -- --token=your_firebase_id_token_here
```

### Debug Mode

To see what environment variables are being loaded:

```bash
npm run test:system:debug
```

## Running the Tests

```bash
# Run all tests
npm run test:system

# Or directly with ts-node
ts-node -r tsconfig-paths/register scripts/test-system.ts
```

## What Gets Tested

The script tests:

1. **Health Check** - API is running and healthy
2. **Authentication** - User creation/update
3. **User Management** - Get user, subscription status, referral stats
4. **Locations** - Get and create locations
5. **Inventory** - Get, create, and update inventory items
6. **Supplies** - Get supplies and categories
7. **Kits** - Get kits, templates, and create kits
8. **Premium Features** - Verify premium gates work (should fail for free users)
9. **Admin Features** - Verify admin gates work (should fail for non-admin users)
10. **Notifications** - Get notifications and preferences
11. **Compliance** - Get compliance checks
12. **Cleanup** - Optionally delete test data

## Expected Results

- **Free User**: Most tests should pass, premium/admin tests should return 403
- **Premium User**: All tests except admin tests should pass
- **Admin User**: All tests should pass

## Troubleshooting

### "TEST_AUTH_TOKEN not set"

Set the `TEST_AUTH_TOKEN` environment variable with a valid Firebase ID token.

### "401 Unauthorized"

Your Firebase token may have expired. Get a fresh token and update `TEST_AUTH_TOKEN`.

### "403 Forbidden" on Premium/Admin Tests

This is expected for free/non-admin users. The tests verify that the gates work correctly.

### Tests Failing

1. Ensure the API server is running
2. Check that your Firebase project is configured correctly
3. Verify your test user exists in Firestore
4. Check API logs for detailed error messages

## Notes

- The script creates test data (locations, inventory items, kits)
- Set `CLEANUP_TEST_DATA=true` to automatically delete test data after tests
- Test data uses names like "Test Location", "Test Supply Item", "Test Kit" for easy identification
- The script is designed to be idempotent - you can run it multiple times
