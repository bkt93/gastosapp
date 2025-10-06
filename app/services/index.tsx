// app/services/index.tsx
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, Text, View } from "react-native";
import ProjectTabs from "../../src/components/ProjectTabs";
import { auth } from "../../src/firebase";
import { cancelServiceReminders, scheduleServiceReminders } from "../../src/notifications/services-reminders";
import { subscribeProjectMembers, type ProjectMember } from "../../src/services/members.read";
import { deleteService, listenPendingServices, markServiceAsPaid, Service } from "../../src/services/services";
import { formatARS } from "../../src/utils/money";

export default function ServicesIndex() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    const [items, setItems] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // miembros
    const [members, setMembers] = useState<ProjectMember[]>([]);
    useEffect(() => subscribeProjectMembers(String(projectId), setMembers), [projectId]);

    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) => map.set(m.uid, (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`));
        return map;
    }, [members]);

    useEffect(() => {
        setLoading(true);
        setError(null);

        return listenPendingServices(
            String(projectId),
            async (arr) => {
                setItems(arr);
                setLoading(false);
                // Agendar notis para cada pendiente (si no estaban agendadas)
                for (const s of arr) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const due = new Date(s.dueDate);
                    due.setHours(0, 0, 0, 0);
                    if (due >= today) {
                        await scheduleServiceReminders(s.id, s.title, s.dueDate, formatARS(s.amountCents));
                    }
                }
            },
            (e) => {
                console.error(e);
                setError(e?.message ?? "Error cargando servicios");
                setLoading(false);
            }
        );
    }, [projectId]);

    // Modal marcar pagado
    const [modal, setModal] = useState<{ open: boolean; service?: Service }>({ open: false });
    const [paidAt, setPaidAt] = useState(new Date());
    const [paidByUid, setPaidByUid] = useState<string>("");
    const [paidByName, setPaidByName] = useState<string>("");
    const [showPaidPicker, setShowPaidPicker] = useState(false);

    function openPay(s: Service) {
        setModal({ open: true, service: s });
        setShowPaidPicker(false);
        setPaidAt(new Date());
        const uid = s.assignedToUid || s.createdByUid;
        const fallbackName = nameByUid.get(uid) || s.assignedToName || s.createdByName;
        setPaidByUid(uid);
        setPaidByName(fallbackName);
    }

    async function confirmPay() {
        const s = modal.service!;
        try {
            await markServiceAsPaid(String(projectId), s.id, {
                paidAt,
                paidByUid,
                paidByName,
                createdByUid: auth.currentUser?.uid || paidByUid,
            });
            await cancelServiceReminders(s.id);
            setModal({ open: false });
            router.push({ pathname: "/expenses", params: { projectId: String(projectId) } });
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo marcar como pagado");
        }
    }

    function openEdit(s: Service) {
        router.push({
            pathname: `/services/${s.id}/edit`,
            params: { projectId: String(projectId) },
        });
    }

    async function confirmDelete(s: Service) {
        const warn = s.status === "paid" && s.linkedExpenseId
            ? "\n\nEste servicio ya está pagado y tiene un gasto vinculado; no se borrará el gasto."
            : "";
        Alert.alert("Eliminar", `¿Eliminar este servicio?${warn}`, [
            { text: "Cancelar" },
            {
                text: "Eliminar",
                style: "destructive",
                onPress: async () => {
                    try {
                        await cancelServiceReminders(s.id);
                        await deleteService(String(projectId), s.id);
                        // No hay que refrescar: el onSnapshot actualiza la lista solo
                    } catch (e: any) {
                        Alert.alert("Error", e?.message ?? "No se pudo eliminar");
                    }
                },
            },
        ]);
    }

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8 }}>Cargando…</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <ProjectTabs projectId={String(projectId)} current="services" />
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Servicios pendientes</Text>
            {error && <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text>}

            {items.length === 0 ? (
                <View style={{ alignItems: "center", justifyContent: "center", marginTop: 40 }}>
                    <Text style={{ color: "#aaa", marginBottom: 12 }}>No tenés servicios pendientes.</Text>
                    <Pressable
                        onPress={() => router.push({ pathname: "/services/new", params: { projectId: String(projectId) } })}
                        style={{ backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "700" }}>Añadir servicio</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(it) => it.id}
                    contentContainerStyle={{ gap: 8, paddingBottom: 80 }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => openEdit(item)}          // 👈 Tap en la card → Editar
                            style={{
                                backgroundColor: "#111",
                                borderColor: "#333",
                                borderWidth: 1,
                                borderRadius: 10,
                                padding: 12,
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "600" }}>{item.title}</Text>
                            <Text style={{ color: "#aaa", marginTop: 2 }}>
                                {item.type} • vence {new Date(item.dueDate).toLocaleDateString()}
                            </Text>
                            <Text style={{ color: "#fff", marginTop: 6 }}>{formatARS(item.amountCents)}</Text>

                            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                                <Pressable
                                    onPress={(e) => { e.stopPropagation(); openPay(item); }}
                                    style={{ backgroundColor: "#22c55e", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 }}
                                >
                                    <Text style={{ color: "#000", fontWeight: "700" }}>Marcar pagado</Text>
                                </Pressable>

                                <Pressable
                                    onPress={(e) => { e.stopPropagation(); openEdit(item); }}
                                    style={{ backgroundColor: "#374151", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "#4b5563" }}
                                >
                                    <Text style={{ color: "#fff", fontWeight: "700" }}>Editar</Text>
                                </Pressable>

                                <Pressable
                                    onPress={(e) => { e.stopPropagation(); confirmDelete(item); }}
                                    style={{ backgroundColor: "#ef4444", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 }}
                                >
                                    <Text style={{ color: "#fff", fontWeight: "700" }}>Eliminar</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    )}

                />
            )}

            {/* Botón flotante Añadir */}
            <Pressable
                onPress={() => router.push({ pathname: "/services/new", params: { projectId: String(projectId) } })}
                style={{
                    position: "absolute",
                    right: 16,
                    bottom: 24,
                    backgroundColor: "#2563eb",
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: 999,
                }}
            >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Añadir</Text>
            </Pressable>

            {/* Modal pagar */}
            <Modal visible={modal.open} transparent animationType="fade" onRequestClose={() => setModal({ open: false })}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <View style={{ backgroundColor: "#1f2937", padding: 16, borderRadius: 12, width: "100%", gap: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Confirmar pago</Text>

                        <Text style={{ color: "#fff" }}>Fecha de pago</Text>
                        <Text style={{ color: "#fff" }}>Fecha de pago</Text>

                        <Pressable
                            onPress={() => setShowPaidPicker(true)}
                            style={{
                                backgroundColor: "#111",
                                borderRadius: 10,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "#333",
                            }}
                        >
                            <Text style={{ color: "#fff" }}>
                                {paidAt.toLocaleDateString()}
                            </Text>
                            <Text style={{ color: "#aaa", marginTop: 4 }}>Tocar para elegir fecha</Text>
                        </Pressable>

                        {showPaidPicker && (
                            <DateTimePicker
                                value={paidAt}
                                mode="date"
                                display={Platform.OS === "ios" ? "inline" : "default"}
                                onChange={(event: DateTimePickerEvent, date?: Date) => {
                                    if (Platform.OS === "android") setShowPaidPicker(false);
                                    if (event.type === "set" && date) {
                                        setPaidAt(date);
                                        if (Platform.OS === "ios") setShowPaidPicker(false);
                                    } else if (event.type === "dismissed") {
                                        setShowPaidPicker(false);
                                    }
                                }}
                            />
                        )}


                        <Text style={{ color: "#fff" }}>Pagado por</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {members.map((m) => {
                                const name = (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;
                                return (
                                    <Pressable
                                        key={m.uid}
                                        onPress={() => {
                                            setPaidByUid(m.uid);
                                            setPaidByName(name);
                                        }}
                                        style={{
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: paidByUid === m.uid ? "#60a5fa" : "#333",
                                            backgroundColor: paidByUid === m.uid ? "#1e293b" : "#111",
                                        }}
                                    >
                                        <Text style={{ color: "#fff" }}>{name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                            <Pressable onPress={confirmPay} style={{ flex: 1, backgroundColor: "#22c55e", padding: 12, borderRadius: 10, alignItems: "center" }}>
                                <Text style={{ fontWeight: "700" }}>Confirmar</Text>
                            </Pressable>
                            <Pressable onPress={() => setModal({ open: false })} style={{ width: 120, backgroundColor: "#ef4444", padding: 12, borderRadius: 10, alignItems: "center" }}>
                                <Text style={{ color: "#fff", fontWeight: "700" }}>Cancelar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
