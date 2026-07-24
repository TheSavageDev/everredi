import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApi } from '@/lib/api';
import { LEGAL_BASE_URL, signInWithApple, signInWithOAuthProvider } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';

export default function LoginScreen() {
  const router = useRouter();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function afterAuth() {
    const { workspace } = await getApi().auth.createOrUpdate();
    setWorkspace(workspace);
    router.replace('/(tabs)/kits');
  }

  async function submit() {
    setError(null);
    if (mode === 'signup' && !accepted) {
      setError('Please accept the terms to continue');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
      await afterAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auth failed');
    } finally {
      setLoading(false);
    }
  }

  async function social(provider: 'google' | 'apple') {
    setError(null);
    if (mode === 'signup' && !accepted) {
      setError('Please accept the terms to continue');
      return;
    }
    setLoading(true);
    try {
      if (provider === 'apple') {
        await signInWithApple();
      } else {
        await signInWithOAuthProvider('google');
      }
      await afterAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Social sign in failed');
    } finally {
      setLoading(false);
    }
  }

  function openLegal(path: string) {
    void Linking.openURL(`${LEGAL_BASE_URL}${path}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>EverRedi</Text>
      <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>

      <Pressable
        style={[styles.social, styles.google, loading && styles.disabled]}
        disabled={loading}
        onPress={() => void social('google')}
      >
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>
      <Pressable
        style={[styles.social, styles.apple, loading && styles.disabled]}
        disabled={loading}
        onPress={() => void social('apple')}
      >
        <Text style={styles.appleText}>
          {Platform.OS === 'ios' ? 'Continue with Apple' : 'Continue with Apple'}
        </Text>
      </Pressable>

      <Text style={styles.divider}>or email</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
      />

      {mode === 'signup' ? (
        <Pressable style={styles.acceptRow} onPress={() => setAccepted((v) => !v)}>
          <View style={[styles.checkbox, accepted && styles.checkboxOn]} />
          <Text style={styles.acceptText}>
            I agree to the{' '}
            <Text style={styles.link} onPress={() => openLegal('/terms')}>
              Terms
            </Text>
            ,{' '}
            <Text style={styles.link} onPress={() => openLegal('/privacy')}>
              Privacy
            </Text>
            , and{' '}
            <Text style={styles.link} onPress={() => openLegal('/eula')}>
              EULA
            </Text>
            , and acknowledge the{' '}
            <Text style={styles.link} onPress={() => openLegal('/disclaimer')}>
              Disclaimer
            </Text>
            .
          </Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, loading && styles.disabled]}
        disabled={loading}
        onPress={() => void submit()}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
        </Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.switch}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </Text>
      </Pressable>
      <View style={styles.legalRow}>
        <Text style={styles.link} onPress={() => openLegal('/terms')}>
          Terms
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => openLegal('/privacy')}>
          Privacy
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => openLegal('/eula')}>
          EULA
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => openLegal('/disclaimer')}>
          Disclaimer
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#E8EEF5' },
  brand: { fontSize: 34, fontWeight: '700', color: '#1B2A4A', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16, color: '#1B2A4A' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(27,42,74,0.12)',
  },
  button: {
    backgroundColor: '#2F6FED',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  switch: { marginTop: 16, color: '#1B2A4A', textAlign: 'center' },
  error: { color: '#b91c1c', marginBottom: 8 },
  social: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  google: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(27,42,74,0.12)',
  },
  googleText: { color: '#1B2A4A', fontWeight: '700' },
  apple: { backgroundColor: '#1B2A4A' },
  appleText: { color: '#fff', fontWeight: '700' },
  divider: {
    textAlign: 'center',
    color: 'rgba(27,42,74,0.45)',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1,
    marginVertical: 12,
  },
  acceptRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(27,42,74,0.35)',
    marginTop: 2,
    backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: '#2F6FED', borderColor: '#2F6FED' },
  acceptText: { flex: 1, color: '#1B2A4A', fontSize: 13, lineHeight: 18 },
  link: { color: '#2F6FED', textDecorationLine: 'underline', fontSize: 13 },
  legalRow: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { color: 'rgba(27,42,74,0.45)' },
  disabled: { opacity: 0.6 },
});
