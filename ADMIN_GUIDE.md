# Admin User Guide

This guide provides instructions for administrators on how to manage the Everredi platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Managing Sponsored Supplies](#managing-sponsored-supplies)
3. [Brand Partnerships](#brand-partnerships)
4. [Managing Users](#managing-users)
5. [Public Kit Templates](#public-kit-templates)

## Getting Started

### Setting Up Admin Access

To grant admin access to a user, use the admin setup script:

```bash
cd api
npm run set-admin <user-email>
```

This will set the `isAdmin` flag to `true` for the specified user in Firestore.

### Accessing Admin Features

Admin features are available in the web application at:

- `/admin/sponsored-supplies` - Manage sponsored supplies
- `/admin/brand-partnerships` - Manage brand partnerships

All admin endpoints are protected by the `AdminGuard`, which verifies the user has `isAdmin: true` in their user document.

## Managing Sponsored Supplies

Sponsored supplies are highlighted in the supply catalog to increase visibility.

### Marking a Supply as Sponsored

1. Navigate to `/admin/sponsored-supplies` in the web app
2. Search for the supply you want to sponsor
3. Toggle the "Sponsored" switch for that supply
4. The supply will now appear with a sponsored badge in the catalog

### API Endpoint

```http
PATCH /api/supplies/:id
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "isSponsored": true
}
```

**Note**: This endpoint requires admin access. Non-admin users will receive a `403 Forbidden` response.

## Brand Partnerships

Brand partnerships allow you to feature brands in the supply catalog and create "recommended by" sections.

### Creating a Brand Partnership

1. Navigate to `/admin/brand-partnerships` in the web app
2. Click "Create Partnership"
3. Fill in the partnership details:
   - **Brand Name**: The name of the brand
   - **Logo URL**: URL to the brand's logo image
   - **Website URL**: Link to the brand's website
   - **Description**: Brief description of the partnership
   - **Partnership Type**: Choose from:
     - `featured` - Highest priority, shown prominently
     - `sponsor` - Sponsored content
     - `recommended` - Recommended brand
   - **Priority**: Number (higher = more prominent)
   - **Category IDs**: Optional array of category IDs this brand applies to
   - **Start Date**: When the partnership becomes active
   - **End Date**: Optional expiration date
4. Click "Save"

### Managing Partnerships

- **View All**: See all partnerships (active and inactive)
- **Edit**: Update partnership details
- **Delete**: Remove a partnership (soft delete by setting `isActive: false`)

### API Endpoints

#### Get All Partnerships (Admin Only)

```http
GET /api/brand-partnerships/all
Authorization: Bearer <firebase-token>
```

#### Create Partnership (Admin Only)

```http
POST /api/brand-partnerships
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "brandName": "Example Brand",
  "logoUrl": "https://example.com/logo.png",
  "websiteUrl": "https://example.com",
  "description": "A great brand for emergency supplies",
  "partnershipType": "featured",
  "priority": 10,
  "categoryIds": ["cat1", "cat2"],
  "startDate": "2024-01-01T00:00:00Z"
}
```

#### Update Partnership (Admin Only)

```http
PATCH /api/brand-partnerships/:id
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "priority": 15,
  "isActive": true
}
```

#### Delete Partnership (Admin Only)

```http
DELETE /api/brand-partnerships/:id
Authorization: Bearer <firebase-token>
```

## Managing Users

### Viewing User Information

User information can be accessed through the Firestore console or by querying the API:

```http
GET /api/users/me
Authorization: Bearer <firebase-token>
```

### User Fields

Key fields in the user document:

- `isAdmin`: Boolean flag for admin access
- `onboardingCompleted`: Whether user completed onboarding
- `subscriptionTier`: `'free'` or `'premium'`
- `subscriptionStatus`: `'active'`, `'cancelled'`, or `'expired'`
- `referralCode`: User's unique referral code
- `referredBy`: User ID of the referrer (if applicable)

### Granting Admin Access

Use the admin setup script (see [Getting Started](#getting-started)) or manually update in Firestore:

```javascript
// In Firestore console or via Admin SDK
db.collection('users').doc(userId).update({
  isAdmin: true,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

## Public Kit Templates

Public kit templates are pre-configured kits that all users can browse and use as starting points.

### Creating a Public Template (Admin Only)

```http
POST /api/kits/public-templates
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "name": "Emergency First Aid Kit",
  "description": "Essential first aid supplies for emergencies",
  "category": "first-aid",
  "items": [
    {
      "supplyName": "Bandages",
      "quantity": 10,
      "supplyId": "supply-123"
    }
  ]
}
```

### Updating a Public Template (Admin Only)

```http
PUT /api/kits/public-templates/:id
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "name": "Updated Kit Name",
  "description": "Updated description"
}
```

### Deleting a Public Template (Admin Only)

```http
DELETE /api/kits/public-templates/:id
Authorization: Bearer <firebase-token>
```

## Security Notes

1. **Admin Endpoints**: All admin endpoints are protected by `AdminGuard`. Only users with `isAdmin: true` can access them.

2. **Firebase Token**: Admin endpoints require a valid Firebase ID token in the `Authorization` header.

3. **Audit Trail**: Consider logging admin actions for audit purposes (not currently implemented but recommended for production).

4. **Multiple Admins**: You can have multiple admin users. Each admin has full access to all admin features.

## Troubleshooting

### "Admin access required" Error

- Verify the user has `isAdmin: true` in their Firestore user document
- Ensure the Firebase token is valid and not expired
- Check that the `AdminGuard` is properly applied to the endpoint

### Changes Not Reflecting

- Clear browser cache
- Verify the change was saved in Firestore
- Check that the frontend is reading from the correct Firestore collection

## Best Practices

1. **Sponsored Supplies**: Use sparingly to maintain user trust. Too many sponsored items can reduce catalog quality.

2. **Brand Partnerships**:
   - Set appropriate priority levels (10-20 for featured, 5-10 for sponsors, 1-5 for recommended)
   - Use category filtering to show relevant brands
   - Set end dates for time-limited partnerships

3. **Public Templates**:
   - Keep templates up-to-date with current best practices
   - Include clear descriptions
   - Ensure all referenced supplies exist in the catalog

4. **User Management**:
   - Grant admin access only to trusted users
   - Regularly review admin user list
   - Document why admin access was granted

## Support

For additional help or questions about admin features, contact the development team or refer to the main project documentation.
