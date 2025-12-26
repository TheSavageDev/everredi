# EverRedi API Postman Collection

This directory contains the Postman collection and environments for the EverRedi API.

## Files

- `EverRedi-API.postman_collection.json` - Complete API collection with all endpoints
- `EverRedi-Environments.postman_environment.json` - Environment variables for localhost, staging, and production
- `scripts/` - Helper scripts for authentication and testing

## Import Instructions

### Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `EverRedi-API.postman_collection.json`
5. Click **Import**

### Import Environments

1. Open Postman
2. Click **Import** button
3. Select **File** tab
4. Choose `EverRedi-Environments.postman_environment.json`
5. Click **Import**

### Set Up Environment

1. Click the environment dropdown (top right)
2. Select **EverRedi Environments**
3. Click the eye icon to edit
4. Set `firebase_token` to your Firebase ID token
5. Set `base_url` to your API URL:
   - **Localhost**: `http://localhost:5050`
   - **Staging**: `https://everredi-api-staging-924111630132.us-central1.run.app`
   - **Production**: `https://api.everredi.com` (or your production URL)

## Getting a Firebase Token

### From Web App

1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Find Firebase Auth token in localStorage or sessionStorage
4. Copy the `idToken` value

### From Firebase Console

1. Go to Firebase Console
2. Navigate to Authentication
3. Find your user
4. Use Firebase Admin SDK or client SDK to generate a token

### Programmatically

```javascript
// Using Firebase JS SDK
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken();
```

## Usage

### Running Requests

1. Select an environment from the dropdown
2. Ensure `firebase_token` is set
3. Select a request from the collection
4. Click **Send**

### Running Tests

1. Send a request
2. View test results in the **Test Results** tab
3. Tests automatically run after each request

### Using Environment Variables

The collection automatically:

- Sets `Authorization` header from `firebase_token`
- Extracts `user_id` from the token
- Sets `test_kit_id`, `test_location_id`, `test_inventory_id` from responses

## Authentication Flow

**Important**: The API does not have a traditional login endpoint. Authentication is handled entirely client-side using Firebase Auth.

**Login Process**:

1. User authenticates with Firebase Auth SDK (web/mobile app)
   - Email/password, Google OAuth, Apple Sign-In, etc.
2. Firebase returns an ID token
3. Client calls `/api/auth/create-or-update` with the token
4. API verifies token and syncs user data to Firestore

**For Postman Testing**:

- Get a Firebase ID token from your client app (see "Getting a Firebase Token" section)
- Set it as `firebase_token` in the environment
- The collection automatically adds it to the Authorization header

## Collection Structure

The collection is organized into folders:

- **Health** - Health check endpoint
- **Authentication** - Post-login user data sync (not a login endpoint)
- **Users** - User management
- **Locations** - Location management
- **Inventory** - Inventory item management
- **Kits - Templates** - Kit template management
- **Kits - User Kits** - User kit management
- **Kits - Public Templates** - Public template browsing
- **Sharing** - Kit sharing (Premium)
- **Subscriptions** - Subscription management
- **AI Recommendations** - AI-powered recommendations (Premium)
- **Supplies** - Supply catalog
- **Supply Categories** - Supply categories
- **API Keys** - API key management (Premium)
- **Bulk Operations** - Bulk import/export (Premium)
- **Analytics** - Analytics endpoints
- **Compliance** - OSHA compliance checking
- **Notifications** - Notification management
- **Advanced Notifications** - Advanced notification features (Premium)
- **Custom Fields** - Custom field management (Premium)
- **Teams** - Team management (Premium)
- **Categories** - User category management (Premium)
- **Affiliate** - Affiliate tracking
- **Support** - Support tickets (Premium)
- **Brand Partnerships** - Brand partnership browsing

## Premium Endpoints

Some endpoints require a premium subscription. If you receive a 403 Forbidden error, ensure:

1. Your user has an active premium subscription
2. The subscription status is correctly set in Firestore

## Rate Limiting

The API implements per-user rate limiting (typically 100 requests per minute). If you receive 429 Too Many Requests:

1. Wait a minute before retrying
2. Reduce request frequency
3. Use bulk operations where possible

## Troubleshooting

### 401 Unauthorized

- Check that `firebase_token` is set in the environment
- Verify the token is valid and not expired
- Regenerate the token if needed

### 403 Forbidden

- Check if the endpoint requires premium subscription
- Verify your user has the required subscription status

### 404 Not Found

- Verify the endpoint URL is correct
- Check that resource IDs exist
- Ensure you're using the correct environment

### Tests Failing

- Check response structure matches expected format
- Verify environment variables are set correctly
- Review test scripts for specific requirements

## Maintenance

When API endpoints are added, modified, or removed:

1. Update the Postman collection
2. Update environment variables if needed
3. Update test scripts if response format changes
4. Run collection tests to verify compatibility
5. Update this README if needed

See `../scripts/update-postman.sh` for a maintenance checklist.
