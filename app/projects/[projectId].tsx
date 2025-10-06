// app/projects/[projectId].tsx
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Share, Text, TextInput, View } from 'react-native';
import { auth, db } from '../../src/firebase';
import {
    generateInvite,
    revokeInvite,
    subscribePendingInvites,
    type PendingInvite,
} from '../../src/services/invites';
import { subscribeProjectMembers, type ProjectMember } from '../../src/services/members.read';
import { deleteProjectDeep, updateProject } from '../../src/services/projects';


type ProjectDoc = { name: string; currency: string; ownerUid: string };

export default function ProjectTemplateScreen() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();

    const [project, setProject] = useState<ProjectDoc | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const isOwner = !!authUser?.uid && project?.ownerUid === authUser.uid;

    const [editOpen, setEditOpen] = useState(false);
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('ARS');

    // Invites
    const [pending, setPending] = useState<PendingInvite[]>([]);
    const currentInvite = pending[0] ?? null;

    const [members, setMembers] = useState<ProjectMember[]>([]);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, setAuthUser);
        return () => unsubAuth();
    }, []);

    // Suscripción a invites pendientes (owner)
    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribePendingInvites(String(projectId), (rows) => {
            // ordenamos por fecha de expiración (más reciente primero)
            const sorted = [...rows].sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime());
            setPending(sorted);
        });
        return () => unsub();
    }, [projectId]);

    const openEdit = () => {
        if (!project) return;
        setName(project.name);
        setCurrency(project.currency);
        setEditOpen(true);
    };

    const saveEdit = async () => {
        try {
            await updateProject(String(projectId), { name: name.trim(), currency: currency.trim() });
            setEditOpen(false);
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo actualizar');
        }
    };

    const confirmDelete = () => {
        Alert.alert(
            'Eliminar proyecto',
            'Esta acción no se puede deshacer. ¿Querés eliminar el proyecto y sus invitaciones/miembros?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteProjectDeep(String(projectId));
                            router.replace('/home');
                        } catch (e: any) {
                            Alert.alert('Error', e?.message ?? 'No se pudo eliminar');
                        }
                    },
                },
            ]
        );
    };

    // Invites: acciones
    const onGenerate = async () => {
        try {
            await generateInvite(String(projectId));
        } catch (e: any) {
            Alert.alert('Invitar', e?.message ?? 'No se pudo generar la invitación');
        }
    };

    const onShare = async () => {
        if (!currentInvite) return;
        const msg =
            `Sumate a mi proyecto en GastosApp.\n` +
            `Código: ${currentInvite.code}\n\n` +
            `Abrí la app y usá "Unirme por código".`;
        try {
            await Share.share({ message: msg });
        } catch { }
    };

    const onRevoke = async () => {
        if (!currentInvite) return;
        try {
            await revokeInvite(currentInvite.id);
        } catch (e: any) {
            Alert.alert('Invitar', e?.message ?? 'No se pudo revocar la invitación');
        }
    };

    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(
            doc(db, 'projects', String(projectId)),
            (snap) => {
                const d = snap.data() as any;
                if (d) {
                    setProject({ name: d.name, currency: d.currency, ownerUid: d.ownerUid });
                    setLoadErr(null);
                } else {
                    setLoadErr('Proyecto no encontrado');
                }
            },
            (err) => {
                console.log('project onSnapshot error:', err);
                setLoadErr('No tenés permiso para ver este proyecto o fue eliminado.');
            }
        );
        return () => unsub();
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeProjectMembers(String(projectId), setMembers);
        return () => unsub();
    }, [projectId]);

    return (
        <View style={{ flex: 1, padding: 16, backgroundColor: '#f9fafb' }}>
            <Stack.Screen options={{ title: project?.name ?? 'Proyecto' }} />

            {loadErr ? <Text style={{ color: '#ef4444' }}>{loadErr}</Text> : null}

            {project && !loadErr ? (
                <>
                    {/* Header con badge */}
                    <View style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 22, fontWeight: '700' }}>{project.name}</Text>

                            <View style={{
                                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999,
                                backgroundColor: isOwner ? '#E5F2FF' : '#F1F5F9',
                                borderWidth: 1, borderColor: isOwner ? '#93C5FD' : '#CBD5E1',
                            }}>
                                <Text style={{
                                    fontSize: 12, fontWeight: '700',
                                    color: isOwner ? '#1D4ED8' : '#334155'
                                }}>
                                    {isOwner ? 'Propietario' : 'Miembro'}
                                </Text>
                            </View>
                        </View>

                        <Text style={{ color: '#6b7280', marginTop: 6 }}>
                            Moneda: {project.currency}
                        </Text>
                    </View>

                    {/* Acciones Owner */}
                    {isOwner ? (
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                            <Pressable onPress={openEdit} style={{ backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 }}>
                                <Text style={{ color: 'white', fontWeight: '600' }}>Editar</Text>
                            </Pressable>
                            <Pressable onPress={confirmDelete} style={{ borderColor: '#ef4444', borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 }}>
                                <Text style={{ color: '#ef4444', fontWeight: '600' }}>Eliminar</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {/* Sección Invitar (solo owner) */}
                    {isOwner ? (
                        <View style={{ marginTop: 24, backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Invitar</Text>

                            {currentInvite ? (
                                <>
                                    <Text style={{ marginBottom: 6 }}>Código vigente:</Text>
                                    <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 2, marginBottom: 8 }}>
                                        {currentInvite.code}
                                    </Text>
                                    <Text style={{ color: '#6b7280', marginBottom: 12 }}>
                                        Expira: {currentInvite.expiresAt.toLocaleDateString()} {currentInvite.expiresAt.toLocaleTimeString()}
                                    </Text>

                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <Pressable onPress={onShare} style={{ flex: 1, backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
                                            <Text style={{ color: 'white', fontWeight: '600' }}>Compartir</Text>
                                        </Pressable>
                                        <Pressable onPress={onRevoke} style={{ flex: 1, borderWidth: 1, borderColor: '#ef4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
                                            <Text style={{ color: '#ef4444', fontWeight: '600' }}>Revocar</Text>
                                        </Pressable>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={{ color: '#6b7280', marginBottom: 12 }}>
                                        No hay invitaciones pendientes. Generá un código nuevo.
                                    </Text>
                                    <Pressable onPress={onGenerate} style={{ backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
                                        <Text style={{ color: 'white', fontWeight: '600' }}>Generar invitación</Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    ) : null}

                    {/* Sección Miembros (solo owner) */}
                    {isOwner ? (
                        <View style={{ marginTop: 24, backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Miembros</Text>

                            {members.length === 0 ? (
                                <Text style={{ color: '#6b7280' }}>No hay miembros aún.</Text>
                            ) : (
                                members.map(m => (
                                    <View key={m.uid} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontWeight: '600' }}>
                                                {m.uid}{m.uid === authUser?.uid ? ' (vos)' : ''}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#64748b' }}>
                                                {m.role === 'owner' ? 'Propietario' : 'Miembro'}
                                            </Text>
                                        </View>
                                        {m.joinedAt && (
                                            <Text style={{ color: '#94a3b8', marginTop: 2 }}>
                                                Se unió: {m.joinedAt.toLocaleDateString()} {m.joinedAt.toLocaleTimeString()}
                                            </Text>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    ) : null}

                    <Link
                        href={{ pathname: "/expenses", params: { projectId: String(projectId) } }}
                        asChild
                    >
                        <Pressable style={{ padding: 12, borderRadius: 10, backgroundColor: "#0ea5e9" }}>
                            <Text style={{ color: "#fff", fontWeight: "700" }}>Gastos del hogar</Text>
                        </Pressable>
                    </Link>

                    <Link
                        href={{ pathname: "/services", params: { projectId: String(projectId) } }}
                        asChild
                    >
                        <Pressable
                            style={{
                                marginTop: 10,
                                backgroundColor: "#2563eb",
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderRadius: 10,
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700" }}>Servicios</Text>
                        </Pressable>
                    </Link>


                </>
            ) : (
                <Text>Cargando…</Text>
            )}

            {/* Modal Editar */}
            <Modal visible={editOpen} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Editar proyecto</Text>

                        <Text style={{ marginBottom: 6 }}>Nombre</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}
                        />

                        <Text style={{ marginBottom: 6 }}>Moneda</Text>
                        <TextInput
                            value={currency}
                            onChangeText={setCurrency}
                            autoCapitalize="characters"
                            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 16 }}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable
                                onPress={() => setEditOpen(false)}
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' }}
                            >
                                <Text>Cancelar</Text>
                            </Pressable>
                            <Pressable
                                onPress={saveEdit}
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#111827' }}
                            >
                                <Text style={{ color: 'white', fontWeight: '600' }}>Guardar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );

}
