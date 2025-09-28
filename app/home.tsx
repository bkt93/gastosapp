// app/home.tsx
import { Stack, useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { clearUser, getStoredUser, type StoredUser } from '../src/auth-storage';
import { auth } from '../src/firebase';
import { createProject } from '../src/services/projects';
import { subscribeSharedProjectsByUid } from '../src/services/projects.members.read';
import { fetchOwnedProjectsOnce, subscribeOwnedProjectsByUid, type ProjectListItem } from '../src/services/projects.read';


export default function HomeScreen() {
    const router = useRouter();
    const [items, setItems] = useState<ProjectListItem[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('ARS');

    const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [authUser, setAuthUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [sharedItems, setSharedItems] = useState<ProjectListItem[]>([]);


    const canCreate = useMemo(
        () => name.trim().length > 0 && authReady && !!authUser,
        [name, authReady, authUser]
    );

    useEffect(() => {
        (async () => {
            const u = await getStoredUser();
            setStoredUser(u);
            setLoadingUser(false);
        })();
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setAuthUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!authReady || !authUser?.uid) return;   // ✅ esperar auth real
        const unsub = subscribeOwnedProjectsByUid(authUser.uid, setItems);
        return () => unsub && unsub();
    }, [authReady, authUser?.uid]);

    useEffect(() => {
        if (!authReady || !authUser?.uid) return;
        const unsub = subscribeSharedProjectsByUid(authUser.uid, setSharedItems);
        return () => unsub && unsub();
    }, [authReady, authUser?.uid]);


    const onCreate = async () => {
        try {
            if (!authReady || !authUser) {
                Alert.alert('Sesión', 'Tu sesión todavía se está restaurando. Probá de nuevo en un momento.');
                return;
            }
            const projectName = name.trim();
            if (!projectName) return;

            const id = await createProject(projectName, currency);

            // ✅ Insertar optimista SIN duplicar
            setItems(prev => {
                const without = prev.filter(p => p.id !== id);
                return [{ id, name: projectName, currency, role: 'owner' }, ...without];
            });

            setShowModal(false);
            setName('');
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo crear el proyecto');
        }
    };




    const onLogout = async () => {
        try {
            await signOut(auth);
        } finally {
            await clearUser?.(); // si tu helper existe
            router.replace('/'); // vuelve al index (auth)
        }
    };

    const reload = async () => {
        try {
            if (!authReady || !authUser?.uid) return;
            const rows = await fetchOwnedProjectsOnce(authUser.uid);
            console.log('fetch once rows:', rows.length);
            setItems(rows); // fuerza a ver lo que devuelve el backend ahora mismo
        } catch (e: any) {
            console.log('fetch once error:', e);
            Alert.alert('Lectura', e?.message ?? String(e));
        }
    };

    if (loadingUser) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8 }}>Cargando…</Text>
            </View>
        );
    }

    const renderProjectCard = ({ item }: { item: ProjectListItem }) => (
        <Pressable
            onPress={() => router.push(`/projects/${item.id}`)}
            style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                backgroundColor: '#fff',
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#e5e7eb',
            })}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>

                <View style={{
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999,
                    backgroundColor: item.role === 'owner' ? '#E5F2FF' : '#F1F5F9',
                    borderWidth: 1, borderColor: item.role === 'owner' ? '#93C5FD' : '#CBD5E1',
                }}>
                    <Text style={{
                        fontSize: 12, fontWeight: '700',
                        color: item.role === 'owner' ? '#1D4ED8' : '#334155'
                    }}>
                        {item.role === 'owner' ? 'Propietario' : 'Miembro'}
                    </Text>
                </View>
            </View>

            <Text style={{ color: '#6b7280', marginTop: 6 }}>
                Moneda: {item.currency}
            </Text>
        </Pressable>
    );


    return (
        <View style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb' }}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Mis proyectos',
                    headerRight: () => (
                        <Pressable onPress={onLogout} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                            <Text style={{ color: '#ef4444', fontWeight: '600' }}>Salir</Text>
                        </Pressable>
                    ),
                }}
            />


            <Pressable
                onPress={() => setShowModal(true)}
                style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: '#111827',
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginBottom: 16,
                })}
            >
                <Text style={{ color: 'white', fontWeight: '600' }}>Crear proyecto</Text>
            </Pressable>

            <Pressable
                onPress={() => router.push('/join')}
                style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: '#ffffff',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginBottom: 16,
                    borderWidth: 1, borderColor: '#e5e7eb',
                })}
            >
                <Text style={{ fontWeight: '600' }}>Unirme por código</Text>
            </Pressable>


            <Pressable onPress={reload} style={{ paddingVertical: 8, alignSelf: 'flex-end' }}>
                <Text style={{ color: '#2563eb' }}>Refrescar (debug)</Text>
            </Pressable>

            <Text style={{ color: '#6b7280', marginBottom: 8 }}>
                UID: {authUser?.uid}
            </Text>

            <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                renderItem={renderProjectCard}
                ListEmptyComponent={
                    <Text style={{ color: '#6b7280' }}>
                        {storedUser ? 'Todavía no tenés proyectos. Creá el primero arriba.' : 'Iniciá sesión para ver tus proyectos.'}
                    </Text>
                }
            />

            {sharedItems.length > 0 && (
                <>
                    <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8 }}>
                        Compartidos conmigo
                    </Text>
                    <FlatList
                        data={sharedItems.filter(s => !items.some(o => o.id === s.id))} // evita duplicados si sos owner
                        keyExtractor={(it) => it.id}
                        renderItem={renderProjectCard}
                        ListEmptyComponent={null}
                    />
                </>
            )}



            <Modal visible={showModal} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Nuevo proyecto</Text>

                        <Text style={{ marginBottom: 6 }}>Nombre</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Hogar 2025"
                            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}
                        />

                        <Text style={{ marginBottom: 6 }}>Moneda</Text>
                        <TextInput
                            value={currency}
                            onChangeText={setCurrency}
                            placeholder="ARS"
                            autoCapitalize="characters"
                            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 16 }}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable
                                onPress={() => setShowModal(false)}
                                style={({ pressed }) => ({
                                    flex: 1, opacity: pressed ? 0.7 : 1, paddingVertical: 12,
                                    borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
                                })}
                            >
                                <Text>Cancelar</Text>
                            </Pressable>

                            <Pressable
                                onPress={onCreate}
                                disabled={!canCreate}
                                style={({ pressed }) => ({
                                    flex: 1, opacity: (!canCreate || pressed) ? 0.6 : 1, paddingVertical: 12,
                                    borderRadius: 10, alignItems: 'center', backgroundColor: '#111827',
                                })}
                            >
                                <Text style={{ color: 'white', fontWeight: '600' }}>Crear</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
