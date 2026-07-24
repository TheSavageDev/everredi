import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

function extractParams(url: string): { code?: string; error?: string; errorDescription?: string } {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const hashParams = new URLSearchParams(hash);
  const code =
    (typeof query.code === 'string' ? query.code : undefined) ??
    hashParams.get('code') ??
    undefined;
  const error =
    (typeof query.error === 'string' ? query.error : undefined) ??
    hashParams.get('error') ??
    undefined;
  const errorDescription =
    (typeof query.error_description === 'string' ? query.error_description : undefined) ??
    hashParams.get('error_description') ??
    undefined;
  return { code, error, errorDescription: errorDescription ?? undefined };
}

export async function signInWithOAuthProvider(provider: 'google' | 'apple') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams:
        provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : undefined,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    throw new Error('Sign in was cancelled');
  }

  const { code, error: oauthError, errorDescription } = extractParams(result.url);
  if (oauthError) {
    throw new Error(errorDescription ?? oauthError);
  }
  if (!code) {
    throw new Error('No authorization code returned');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signInWithAppleNative() {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    await signInWithOAuthProvider('apple');
    return;
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signInWithApple() {
  if (Platform.OS === 'ios') {
    await signInWithAppleNative();
    return;
  }
  await signInWithOAuthProvider('apple');
}

export const LEGAL_BASE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ?? 'https://everredi.vercel.app';
