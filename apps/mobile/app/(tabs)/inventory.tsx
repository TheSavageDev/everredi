import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';

export default function InventoryScreen() {
  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const items = useQuery({
    queryKey: ['inventory', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => getApi().inventory.list(workspaceId!),
  });
  const create = useMutation({
    mutationFn: () =>
      getApi().inventory.create(workspaceId!, {
        freeformName: name,
        supplyName: name,
        actualQuantity: 1,
        requiredQuantity: 1,
      }),
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['inventory', workspaceId] });
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Item name"
          value={name}
          onChangeText={setName}
        />
        <Pressable style={styles.button} onPress={() => name.trim() && create.mutate()}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={items.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.supplyName}</Text>
            <Text style={styles.meta}>
              {item.actualQuantity ?? 0}/{item.requiredQuantity ?? 0} · {item.status}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#E8EEF5' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#2F6FED',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardTitle: { fontWeight: '600', color: '#1B2A4A' },
  meta: { color: '#64748b', marginTop: 4, fontSize: 12 },
});
