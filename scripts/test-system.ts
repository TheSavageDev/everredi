#!/usr/bin/env node

/**
 * Comprehensive System Test Script
 *
 * This script tests the entire system including:
 * - Authentication
 * - User management
 * - Inventory operations
 * - Kit operations
 * - Premium features
 * - Admin features
 * - Referral system
 *
 * Usage: npm run test:system
 * Or: ts-node -r tsconfig-paths/register scripts/test-system.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../.env.local') });

const API_URL = process.env.API_URL || 'http://localhost:5051/api';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// Debug: Show what we found
if (process.env.DEBUG === 'true') {
  console.log('Environment check:');
  console.log(`  API_URL: ${API_URL}`);
  console.log(
    `  TEST_AUTH_TOKEN: ${process.env.TEST_AUTH_TOKEN ? 'SET (' + process.env.TEST_AUTH_TOKEN.substring(0, 20) + '...)' : 'NOT SET'}`,
  );
  console.log(
    `  FIREBASE_AUTH_TOKEN: ${process.env.FIREBASE_AUTH_TOKEN ? 'SET' : 'NOT SET'}`,
  );
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    const errorMessage = error.message || String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    console.error(`❌ ${name} (${duration}ms)`);
    console.error(`   Error: ${errorMessage}`);
  }
}

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    // Remove any existing "Bearer " prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  // Log 401 errors with more detail
  if (response.status === 401 && process.env.DEBUG === 'true') {
    const errorText = await response.text();
    console.error(`   Debug - 401 Response: ${errorText}`);
    console.error(
      `   Debug - Token used: ${token ? token.substring(0, 30) + '...' : 'none'}`,
    );
  }

  return response;
}

async function main() {
  console.log('🧪 Starting Comprehensive System Tests\n');
  console.log(`API URL: ${API_URL}\n`);

  let authToken: string | undefined;
  let userId: string | undefined;
  let locationId: string | undefined;
  let inventoryItemId: string | undefined;
  let kitId: string | undefined;

  // ============================================
  // 1. Health Check
  // ============================================
  await test('Health Check', async () => {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.status !== 'ok' && data.status !== 'degraded') {
      throw new Error(`Unexpected health status: ${data.status}`);
    }
  });

  // ============================================
  // 2. Authentication
  // ============================================
  await test('Authentication - Create/Update User', async () => {
    // Try multiple ways to get the token
    const testToken =
      process.env.TEST_AUTH_TOKEN ||
      process.env.FIREBASE_AUTH_TOKEN ||
      process.argv.find((arg) => arg.startsWith('--token='))?.split('=')[1];

    if (!testToken) {
      console.error('\n❌ No auth token found!');
      console.error('   Set it using one of these methods:');
      console.error(
        '   1. Environment variable: export TEST_AUTH_TOKEN=your_token',
      );
      console.error('   2. .env file: TEST_AUTH_TOKEN=your_token');
      console.error(
        '   3. Command line: npm run test:system -- --token=your_token',
      );
      console.error('\n   To get a token:');
      console.error('   - Sign in to the web app and check browser console');
      console.error('   - Or use Firebase Admin SDK to generate a token');
      throw new Error('TEST_AUTH_TOKEN not set. See instructions above.');
    }

    // Validate token format (Firebase ID tokens are JWT format)
    if (!testToken.includes('.')) {
      throw new Error(
        'Token format appears invalid. Firebase ID tokens should be JWT format (contain dots).',
      );
    }

    const tokenParts = testToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error(
        'Token format appears invalid. Firebase ID tokens should have 3 parts separated by dots.',
      );
    }

    console.log(
      `   Using token: ${testToken.substring(0, 20)}... (${testToken.length} chars)`,
    );
    authToken = testToken;

    const response = await fetchWithAuth(
      '/auth/create-or-update',
      {
        method: 'POST',
      },
      authToken,
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Auth failed: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - ${errorData.message || errorData.error?.message || errorText}`;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Auth response invalid');
    }
    userId = data.data.id || data.data.firebaseUid;
  });

  // ============================================
  // 3. User Management
  // ============================================
  await test('Get Current User', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/users/me', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get user failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Get user response invalid');
    }
  });

  await test('Get Subscription Status', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/users/me/subscription',
      {},
      authToken,
    );
    if (!response.ok) {
      throw new Error(`Get subscription failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Get subscription response invalid');
    }
  });

  await test('Get Referral Stats', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/users/me/referral/stats',
      {},
      authToken,
    );
    if (!response.ok) {
      throw new Error(`Get referral stats failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Get referral stats response invalid');
    }
  });

  // ============================================
  // 4. Locations
  // ============================================
  await test('Get Locations', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/locations', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get locations failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get locations response invalid');
    }

    // Use first location or create one
    if (data.data && data.data.length > 0) {
      locationId = data.data[0].id;
    }
  });

  await test('Create Location', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/locations',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Location',
          locationType: 'home',
          isPrimary: false,
        }),
      },
      authToken,
    );

    if (!response.ok) {
      throw new Error(`Create location failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Create location response invalid');
    }

    if (!locationId) {
      locationId = data.data.id;
    }
  });

  // ============================================
  // 5. Inventory Operations
  // ============================================
  await test('Get Inventory Items', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/inventory', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get inventory failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get inventory response invalid');
    }
  });

  await test('Create Inventory Item', async () => {
    if (!authToken || !locationId) {
      throw new Error('No auth token or location');
    }

    const response = await fetchWithAuth(
      '/inventory',
      {
        method: 'POST',
        body: JSON.stringify({
          supplyName: 'Test Supply Item',
          locationId: locationId,
          quantity: 10,
          status: 'active',
        }),
      },
      authToken,
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Create inventory failed: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Create inventory response invalid');
    }

    inventoryItemId = data.data.id;
  });

  await test('Update Inventory Item', async () => {
    if (!authToken || !inventoryItemId) {
      throw new Error('No auth token or inventory item');
    }

    const response = await fetchWithAuth(
      `/inventory/${inventoryItemId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          quantity: 15,
        }),
      },
      authToken,
    );

    if (!response.ok) {
      throw new Error(`Update inventory failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Update inventory response invalid');
    }
  });

  // ============================================
  // 6. Supplies & Categories
  // ============================================
  await test('Get Supplies', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/supplies', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get supplies failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get supplies response invalid');
    }
  });

  await test('Get Supply Categories', async () => {
    const response = await fetch(`${API_URL}/supply-categories`);
    if (!response.ok) {
      throw new Error(`Get categories failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get categories response invalid');
    }
  });

  // ============================================
  // 7. Kit Operations
  // ============================================
  await test('Get User Kits', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/user-kits', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get kits failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get kits response invalid');
    }
  });

  await test('Get Public Templates', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/public-templates', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get templates failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get templates response invalid');
    }
  });

  await test('Create User Kit', async () => {
    if (!authToken || !locationId) {
      throw new Error('No auth token or location');
    }

    const response = await fetchWithAuth(
      '/user-kits',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Kit',
          locationId: locationId,
          status: 'active',
        }),
      },
      authToken,
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Create kit failed: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error('Create kit response invalid');
    }

    kitId = data.data.id;
  });

  // ============================================
  // 8. Premium Features (should fail for free users)
  // ============================================
  await test('Premium Feature Gate - Analytics', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/analytics/usage-patterns',
      {},
      authToken,
    );

    // Should either be 403 (premium required) or 200 (if user is premium)
    if (response.status === 403) {
      const data = await response.json();
      if (data.code !== 'PREMIUM_REQUIRED') {
        throw new Error('Expected PREMIUM_REQUIRED error code');
      }
      // This is expected for free users
    } else if (!response.ok && response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  await test('Premium Feature Gate - API Keys', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/api-keys',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      },
      authToken,
    );

    // Should either be 403 (premium required) or 201 (if user is premium)
    if (response.status === 403) {
      const data = await response.json();
      if (data.code !== 'PREMIUM_REQUIRED') {
        throw new Error('Expected PREMIUM_REQUIRED error code');
      }
      // This is expected for free users
    } else if (response.status !== 201 && !response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // ============================================
  // 9. Admin Features (should fail for non-admin users)
  // ============================================
  await test('Admin Feature Gate - Sponsored Supplies', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/supplies/test-id',
      {
        method: 'PATCH',
        body: JSON.stringify({ isSponsored: true }),
      },
      authToken,
    );

    // Should be 403 (admin required) unless user is admin
    if (response.status === 403) {
      const data = await response.json();
      if (data.code !== 'ADMIN_REQUIRED') {
        throw new Error('Expected ADMIN_REQUIRED error code');
      }
      // This is expected for non-admin users
    } else if (!response.ok && response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  await test('Admin Feature Gate - Brand Partnerships', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/brand-partnerships/all',
      {},
      authToken,
    );

    // Should be 403 (admin required) unless user is admin
    if (response.status === 403) {
      const data = await response.json();
      if (data.code !== 'ADMIN_REQUIRED') {
        throw new Error('Expected ADMIN_REQUIRED error code');
      }
      // This is expected for non-admin users
    } else if (!response.ok && response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // ============================================
  // 10. Notifications
  // ============================================
  await test('Get Notifications', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/notifications', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get notifications failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get notifications response invalid');
    }
  });

  await test('Get Notification Preferences', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth(
      '/notifications/preferences',
      {},
      authToken,
    );
    if (!response.ok) {
      throw new Error(`Get preferences failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get preferences response invalid');
    }
  });

  // ============================================
  // 11. Compliance
  // ============================================
  await test('Get Compliance Checks', async () => {
    if (!authToken) throw new Error('No auth token');

    const response = await fetchWithAuth('/compliance/checks', {}, authToken);
    if (!response.ok) {
      throw new Error(`Get compliance checks failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error('Get compliance checks response invalid');
    }
  });

  // ============================================
  // 12. Cleanup (optional)
  // ============================================
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    await test('Cleanup - Delete Test Kit', async () => {
      if (!authToken || !kitId) {
        throw new Error('No auth token or kit');
      }

      const response = await fetchWithAuth(
        `/user-kits/${kitId}`,
        { method: 'DELETE' },
        authToken,
      );

      // 200 or 204 is acceptable for delete
      if (!response.ok && response.status !== 204) {
        throw new Error(`Delete kit failed: ${response.status}`);
      }
    });

    await test('Cleanup - Delete Test Inventory Item', async () => {
      if (!authToken || !inventoryItemId) {
        throw new Error('No auth token or inventory item');
      }

      const response = await fetchWithAuth(
        `/inventory/${inventoryItemId}`,
        { method: 'DELETE' },
        authToken,
      );

      if (!response.ok && response.status !== 204) {
        throw new Error(`Delete inventory failed: ${response.status}`);
      }
    });
  }

  // ============================================
  // Summary
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(
    `📈 Average Duration: ${Math.round(totalDuration / results.length)}ms`,
  );

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name}`);
        console.log(`     Error: ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
