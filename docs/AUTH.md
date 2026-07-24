# Auth setup (Supabase)

EverRedi uses Supabase Auth for email/password, Google, and Apple.

Project: [`jszxqowkkyjmplbzbgvf`](https://supabase.com/dashboard/project/jszxqowkkyjmplbzbgvf)  
Callback URL for Google/Apple consoles: `https://jszxqowkkyjmplbzbgvf.supabase.co/auth/v1/callback`

## Apply hosted Auth config (recommended)

App code alone cannot enable providers. Use the Management API script:

```bash
# 1) Personal access token — https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_...

# 2) Optional — enable Google (Web OAuth client from Google Cloud)
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID='....apps.googleusercontent.com'
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET='...'

# 3) Optional — enable Apple (Services ID first, then App ID for native)
export SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID='com.everredi.web,app.everredi'
export SUPABASE_AUTH_EXTERNAL_APPLE_SECRET='...'   # JWT from .p8 key (needed for web OAuth)
# export SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS='app.everredi'

pnpm auth:configure
```

What the script always sets (even without Google/Apple secrets):

- Site URL: `https://everredi.vercel.app`
- Redirect allow list: production callback, Vercel previews, localhost, `everredi://**`
- Email/password signup enabled, JWT expiry 3600s, min password length 8

Local stack mirrors this in [`supabase/config.toml`](../supabase/config.toml).

## Google (provider credentials)

1. Google Cloud → create **Web application** OAuth client.
2. Authorized redirect URI: `https://jszxqowkkyjmplbzbgvf.supabase.co/auth/v1/callback`
3. Authorized JavaScript origins: `https://everredi.vercel.app`, `http://localhost:3000`
4. Paste Client ID + Secret into the env vars above (or Dashboard → Auth → Providers → Google).

For native mobile later, add iOS/Android client IDs as a comma-separated list (web ID first).

## Apple (provider credentials)

1. Apple Developer → enable Sign in with Apple on App ID `app.everredi`.
2. Create a Services ID for web; return URL = Supabase callback above.
3. Create a Sign in with Apple key (`.p8`) and generate the client secret JWT.
4. In Supabase, Client IDs: **Services ID first**, then `app.everredi`.
5. Paste into the env vars above (or Dashboard → Auth → Providers → Apple).

## App flows

- **Web**: PKCE → `/auth/callback` → `/auth/complete` (workspace bootstrap)
- **Mobile Google**: `signInWithOAuth` + `expo-web-browser` (`everredi://auth/callback`)
- **Mobile Apple (iOS)**: `expo-apple-authentication` → `signInWithIdToken`
- **Mobile Apple (Android)**: OAuth browser flow

## Legal

Public pages: `/terms`, `/privacy`, `/eula`, `/disclaimer`. Signup requires acceptance before email or social sign-up.

## Why this is not fully automatic from the agent

The Supabase MCP tools can manage the database, but **not** Auth provider config. Enabling Google/Apple requires:

1. A Supabase **personal access token** (Management API), and
2. OAuth **client ID + secret** from Google Cloud and Apple Developer (we cannot invent those).

Once those values exist as env/secrets, `pnpm auth:configure` finishes the hosted project in one command.
