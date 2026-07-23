import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';

export default function LoginScreen() {
  const router = useRouter();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
      const { workspace } = await getApi().auth.createOrUpdate();
      setWorkspace(workspace);
      router.replace('/(tabs)/kits');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auth failed');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>EverRedi</Text>
      <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={() => void submit()}>
        <Text style={styles.buttonText}>{mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.switch}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </Text>
      </Pressable>
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
});
