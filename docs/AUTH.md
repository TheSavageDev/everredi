# Auth setup (Supabase)

EverRedi uses Supabase Auth for email/password, Google, and Apple.

## Redirect URLs

In [Supabase Auth → URL configuration](https://supabase.com/dashboard/project/jszxqowkkyjmplbzbgvf/auth/url-configuration), add:

- Site URL: `https://everredi.vercel.app` (or your custom domain)
- Redirect allow list:
  - `https://everredi.vercel.app/auth/callback`
  - `https://*.vercel.app/auth/callback` (preview deployments)
  - `http://localhost:3000/auth/callback`
  - Mobile deep link: `everredi://auth/callback`

Web OAuth uses PKCE and lands on `/auth/callback`, then `/auth/complete` to bootstrap the workspace.

## Google

1. Create OAuth credentials in Google Cloud (Web client).
2. Authorized redirect URI: `https://jszxqowkkyjmplbzbgvf.supabase.co/auth/v1/callback`
3. Enable the Google provider in Supabase Auth and paste Client ID + Secret.

## Apple

1. Configure Sign in with Apple in the Apple Developer portal (Services ID for web; App ID `app.everredi` for native).
2. Authorized redirect URI: `https://jszxqowkkyjmplbzbgvf.supabase.co/auth/v1/callback`
3. Enable Apple in Supabase Auth.
4. Put the **Services ID** first in Client IDs if you also use native Sign in with Apple (Expo).

## Mobile

- Google: `signInWithOAuth` + `expo-web-browser` / `expo-auth-session` with scheme `everredi`.
- Apple (iOS): `expo-apple-authentication` → `signInWithIdToken`.
- Apple (Android): OAuth browser flow (same as Google).

## Legal

Public pages: `/terms`, `/privacy`, `/eula`, `/disclaimer`. Signup requires acceptance before email or social sign-up.
