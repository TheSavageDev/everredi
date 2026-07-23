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

export default function WorkspaceScreen() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const qc = useQueryClient();
  const [email, setEmail] = useState('');

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => getApi().workspaces.list(),
  });
  const members = useQuery({
    queryKey: ['members', workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => getApi().workspaces.members(workspace!.id),
  });
  const invite = useMutation({
    mutationFn: () =>
      getApi().workspaces.invite(workspace!.id, { email, role: 'member' }),
    onSuccess: () => {
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['invites', workspace?.id] });
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Workspaces</Text>
      <View style={styles.chips}>
        {(workspaces.data ?? []).map((ws) => (
          <Pressable
            key={ws.id}
            onPress={() => setWorkspace(ws)}
            style={[styles.chip, workspace?.id === ws.id && styles.chipActive]}
          >
            <Text style={workspace?.id === ws.id ? styles.chipActiveText : undefined}>
              {ws.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.heading}>Members</Text>
      <FlatList
        data={members.data ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Text style={styles.member}>
            {item.displayName || item.email || item.userId} · {item.role}
          </Text>
        )}
      />
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Invite email"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Pressable style={styles.button} onPress={() => email.trim() && invite.mutate()}>
          <Text style={styles.buttonText}>Invite</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#E8EEF5' },
  heading: { fontWeight: '700', fontSize: 16, marginBottom: 8, color: '#1B2A4A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#2F6FED' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  member: { paddingVertical: 6, color: '#1B2A4A' },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
});
