import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EVERREDI_PRO_ENTITLEMENT } from '@everredi/types';
import { getApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';

export default function AccountScreen() {
  const router = useRouter();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const me = useQuery({ queryKey: ['me'], queryFn: () => getApi().users.me() });
  const sub = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getApi().subscriptions.status(),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>EverRedi</Text>
      <Text style={styles.line}>Email: {me.data?.email}</Text>
      <Text style={styles.line}>Plan: {sub.data?.tier ?? '…'}</Text>
      <Text style={styles.line}>
        Entitlement: {sub.data?.entitlement ?? `not ${EVERREDI_PRO_ENTITLEMENT}`}
      </Text>
      <Text style={styles.meta}>
        Purchases go through RevenueCat. Entitlement id is always everredi-pro.
      </Text>
      <Pressable
        style={styles.button}
        onPress={async () => {
          await supabase.auth.signOut();
          setWorkspace(null);
          router.replace('/login');
        }}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#E8EEF5' },
  brand: { fontSize: 28, fontWeight: '700', color: '#1B2A4A', marginBottom: 16 },
  line: { marginBottom: 6, color: '#1B2A4A' },
  meta: { marginTop: 12, color: '#64748b', fontSize: 12 },
  button: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(27,42,74,0.15)',
  },
  buttonText: { fontWeight: '600', color: '#1B2A4A' },
});
