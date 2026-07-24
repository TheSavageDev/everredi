#!/usr/bin/env node
/**
 * Apply EverRedi Auth settings to the hosted Supabase project via Management API.
 *
 * Required:
 *   SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens
 *
 * Optional (enables providers when both id+secret present):
 *   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
 *   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET
 *   SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID   (Services ID first, then app.everredi)
 *   SUPABASE_AUTH_EXTERNAL_APPLE_SECRET     (Apple client secret JWT)
 *   SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS
 *
 * Usage:
 *   node scripts/configure-supabase-auth.mjs
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'jszxqowkkyjmplbzbgvf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const SITE_URL = process.env.SUPABASE_AUTH_SITE_URL ?? 'https://everredi.vercel.app';
const URI_ALLOW_LIST = (
  process.env.SUPABASE_AUTH_URI_ALLOW_LIST ??
  [
    'https://everredi.vercel.app/auth/callback',
    'https://*-jasavage42s-projects.vercel.app/auth/callback',
    'https://*.vercel.app/auth/callback',
    'http://localhost:3000/auth/callback',
    'http://127.0.0.1:3000/auth/callback',
    'everredi://auth/callback',
    'everredi://**',
  ].join(',')
);

if (!TOKEN) {
  console.error(
    [
      'Missing SUPABASE_ACCESS_TOKEN.',
      'Create one at https://supabase.com/dashboard/account/tokens',
      'then re-run: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-supabase-auth.mjs',
    ].join('\n'),
  );
  process.exit(1);
}

/** @type {Record<string, unknown>} */
const body = {
  site_url: SITE_URL,
  uri_allow_list: URI_ALLOW_LIST,
  disable_signup: false,
  external_email_enabled: true,
  mailer_autoconfirm: true,
  jwt_exp: 3600,
  password_min_length: 8,
};

const googleId = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID;
const googleSecret = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET;
if (googleId && googleSecret) {
  body.external_google_enabled = true;
  body.external_google_client_id = googleId;
  body.external_google_secret = googleSecret;
  console.log('Google provider: enabling');
} else {
  console.log(
    'Google provider: skipped (set SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID + _SECRET to enable)',
  );
}

const appleId = process.env.SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID;
const appleSecret = process.env.SUPABASE_AUTH_EXTERNAL_APPLE_SECRET;
if (appleId && appleSecret) {
  body.external_apple_enabled = true;
  body.external_apple_client_id = appleId;
  body.external_apple_secret = appleSecret;
  if (process.env.SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS) {
    body.external_apple_additional_client_ids =
      process.env.SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS;
  }
  console.log('Apple provider: enabling');
} else if (appleId && !appleSecret) {
  // Native id_token flows still need the provider enabled with the App ID as client_id.
  // Secret is required for the web OAuth code exchange with Apple.
  body.external_apple_enabled = true;
  body.external_apple_client_id = appleId;
  if (process.env.SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS) {
    body.external_apple_additional_client_ids =
      process.env.SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS;
  }
  console.log(
    'Apple provider: enabling client IDs without secret (native OK; web OAuth needs secret)',
  );
} else {
  console.log(
    'Apple provider: skipped (set SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID, and _SECRET for web)',
  );
}

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json',
    accept: 'application/json',
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Auth config update failed (${res.status}): ${text}`);
  process.exit(1);
}

/** @type {Record<string, unknown>} */
let json = {};
try {
  json = JSON.parse(text);
} catch {
  json = {};
}

console.log('Auth config updated for', PROJECT_REF);
console.log(
  JSON.stringify(
    {
      site_url: json.site_url ?? SITE_URL,
      uri_allow_list: json.uri_allow_list ?? URI_ALLOW_LIST,
      external_email_enabled: json.external_email_enabled,
      external_google_enabled: json.external_google_enabled,
      external_apple_enabled: json.external_apple_enabled,
      external_google_client_id: json.external_google_client_id
        ? '(set)'
        : undefined,
      external_apple_client_id: json.external_apple_client_id ? '(set)' : undefined,
    },
    null,
    2,
  ),
);
