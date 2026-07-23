import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';

export default function AlertsScreen() {
  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);
  const expiring = useQuery({
    queryKey: ['expiring', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().inventory.expiring(workspaceId!),
  });
  const lowStock = useQuery({
    queryKey: ['low-stock', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().inventory.lowStock(workspaceId!),
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Expiring soon</Text>
      {(expiring.data ?? []).map((i) => (
        <Text key={i.id} style={styles.item}>
          {i.supplyName} · {i.expirationDate?.slice(0, 10)}
        </Text>
      ))}
      {(expiring.data ?? []).length === 0 ? <Text style={styles.meta}>None</Text> : null}
      <Text style={[styles.heading, { marginTop: 20 }]}>Low stock</Text>
      {(lowStock.data ?? []).map((i) => (
        <Text key={i.id} style={styles.item}>
          {i.supplyName} · {i.actualQuantity ?? 0}/{i.requiredQuantity ?? 0}
        </Text>
      ))}
      {(lowStock.data ?? []).length === 0 ? <Text style={styles.meta}>None</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#E8EEF5', flexGrow: 1 },
  heading: { fontWeight: '700', fontSize: 16, color: '#1B2A4A', marginBottom: 8 },
  item: { paddingVertical: 4, color: '#1B2A4A' },
  meta: { color: '#64748b' },
});
