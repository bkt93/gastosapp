// app/join.tsx
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { acceptInviteByCode } from '../src/services/accept-invite';
import { ensureSelfMembership } from '../src/services/members.write';

export default function JoinScreen() {
    const router = useRouter();

    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);

    // normalizo a mayúsculas y alfanumérico
    const normalized = useMemo(
        () => code.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
        [code]
    );
    const canSubmit = !busy && normalized.length >= 6; // ajustá si cambiás largo del código

    const onJoin = async () => {
        if (!canSubmit) return;
        setBusy(true);
        try {
            // 1) Aceptar invitación (crea members/{uid}, marca invite accepted y escribe flat)
            const projectId = await acceptInviteByCode(normalized);

            // 2) Autoreparar por las dudas (merge en members + flat)
            await ensureSelfMembership(projectId);

            // 3) Ir directo al proyecto (mejor que volver a /home)
            router.replace(`/projects/${projectId}`);
        } catch (e: any) {
            // Mensajes más claros para los casos típicos
            const msg =
                e?.code === 'permission-denied'
                    ? 'No tenés permisos para completar la invitación. Verificá que el código esté vigente y probá de nuevo.'
                    : e?.message ?? 'No se pudo unir. Verificá el código e intentá de nuevo.';
            Alert.alert('No se pudo unir', msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 16, backgroundColor: '#0b0f17', justifyContent: 'center' }}>
            <Stack.Screen options={{ title: 'Unirme por código' }} />
            <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12, color: 'white' }}>
                Ingresá el código
            </Text>

            <TextInput
                value={normalized}
                onChangeText={setCode}
                autoCapitalize="characters"
                placeholder="ABC123"
                placeholderTextColor="#8b95a1"
                maxLength={10}
                style={{
                    borderWidth: 1,
                    borderColor: '#243041',
                    borderRadius: 10,
                    padding: 14,
                    fontSize: 18,
                    letterSpacing: 2,
                    backgroundColor: '#121a24',
                    color: 'white',
                }}
                editable={!busy}
            />

            <Pressable
                onPress={onJoin}
                disabled={!canSubmit}
                style={({ pressed }) => ({
                    marginTop: 16,
                    opacity: (!canSubmit || pressed) ? 0.6 : 1,
                    backgroundColor: '#2563eb',
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                })}
            >
                {busy ? <ActivityIndicator /> : null}
                <Text style={{ color: 'white', fontWeight: '700' }}>
                    {busy ? 'Uniendo…' : 'Unirme'}
                </Text>
            </Pressable>
        </View>
    );
}
