import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';

export default function Index() {
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        try {
          const { workspace } = await getApi().auth.createOrUpdate();
          setWorkspace(workspace);
          setAuthed(true);
        } catch {
          setAuthed(false);
        }
      }
      setReady(true);
    })();
  }, [setWorkspace]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={authed ? '/(tabs)/kits' : '/login'} />;
}
