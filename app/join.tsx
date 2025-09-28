import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { acceptInviteByCode } from '../src/services/accept-invite';

export default function JoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const normalized = useMemo(() => code.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), [code]);
  const canSubmit = normalized.length >= 6; // si usás 6, ajustá si cambiás el largo

  const onJoin = async () => {
    try {
      const projectId = await acceptInviteByCode(normalized);
      Alert.alert('¡Listo!', 'Te uniste al proyecto', [
        { text: 'Ir al proyecto', onPress: () => router.replace(`/projects/${projectId}`) },
      ]);
    } catch (e: any) {
      Alert.alert('No se pudo unir', e?.message ?? 'Verificá el código e intentá de nuevo');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb', justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Unirme por código' }} />
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Ingresá el código</Text>
      <TextInput
        value={normalized}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="ABC123"
        maxLength={10}
        style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, fontSize: 18, letterSpacing: 2, backgroundColor: 'white' }}
      />
      <Pressable
        onPress={onJoin}
        disabled={!canSubmit}
        style={({ pressed }) => ({
          marginTop: 16,
          opacity: (!canSubmit || pressed) ? 0.6 : 1,
          backgroundColor: '#111827',
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>Unirme</Text>
      </Pressable>
    </View>
  );
}
