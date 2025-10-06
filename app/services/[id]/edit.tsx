// app/services/[id]/edit.tsx
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { db } from "../../../src/firebase";
import { cancelServiceReminders, scheduleServiceReminders } from "../../../src/notifications/services-reminders";
import { subscribeProjectMembers, type ProjectMember } from "../../../src/services/members.read";
import { deleteService, updateService, type Service } from "../../../src/services/services";
import { formatARS, toCents } from "../../../src/utils/money";

const SERVICE_TYPES = ["Luz", "Gas", "Agua", "Cuota IPV", "Resumen tarjeta", "custom"] as const;
type ServiceType = typeof SERVICE_TYPES[number];

export default function EditService() {
    const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    // carga inicial
    const [loading, setLoading] = useState(true);
    const [service, setService] = useState<Service | null>(null);

    // campos editables
    const [type, setType] = useState<ServiceType>("Luz");
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [dueDate, setDueDate] = useState(new Date());
    const [showDuePicker, setShowDuePicker] = useState(false);
    const [description, setDescription] = useState("");
    const [assignedToUid, setAssignedToUid] = useState<string | undefined>(undefined);
    const [assignedToName, setAssignedToName] = useState<string | undefined>(undefined);

    // miembros
    const [members, setMembers] = useState<ProjectMember[]>([]);
    useEffect(() => subscribeProjectMembers(String(projectId), setMembers), [projectId]);
    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) => map.set(m.uid, (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`));
        return map;
    }, [members]);

    const [saving, setSaving] = useState(false);

    // cargar doc
    useEffect(() => {
        let mounted = true;
        (async () => {
            const ref = doc(db, "projects", String(projectId), "services", String(id));
            const snap = await getDoc(ref);
            const d = snap.data() as any;
            if (mounted && d) {
                const s: Service = {
                    id: snap.id,
                    ...d,
                    dueDate: d.dueDate?.toDate?.() ?? new Date(d.dueDate),
                    createdAt: d.createdAt?.toDate?.() ?? new Date(),
                    updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
                };
                setService(s);

                setType((s.type as ServiceType) || "Luz");
                setTitle(s.title || "");
                setAmount(String((s.amountCents ?? 0) / 100));
                setDueDate(s.dueDate);
                setDescription(s.description || "");
                setAssignedToUid(s.assignedToUid);
                setAssignedToName(s.assignedToName);
            }
            if (mounted) setLoading(false);
        })();
        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, projectId]);

    function selectAssigned(uid?: string) {
        if (!uid) {
            setAssignedToUid(undefined);
            setAssignedToName(undefined);
            return;
        }
        setAssignedToUid(uid);
        setAssignedToName(nameByUid.get(uid));
    }

    function onChangeDue(event: DateTimePickerEvent, date?: Date) {
        if (Platform.OS === "android") setShowDuePicker(false);
        if (event.type === "set" && date) {
            setDueDate(date);
            if (Platform.OS === "ios") setShowDuePicker(false);
        } else if (event.type === "dismissed") {
            setShowDuePicker(false);
        }
    }

    async function onSave() {
        const amountCents = toCents(amount);
        if (title.trim().length < 3) return Alert.alert("Título muy corto");
        if (amountCents <= 0) return Alert.alert("Importe inválido");

        try {
            setSaving(true);

            await updateService(String(projectId), String(id), {
                type,
                title: title.trim(),
                amountCents,
                dueDate,
                description: description?.trim() ? description.trim().slice(0, 250) : undefined,
                assignedToUid,
                assignedToName,
            });

            // reprogramar notis si cambió la fecha de vencimiento
            if (service && +service.dueDate !== +dueDate) {
                await cancelServiceReminders(String(id));
                await scheduleServiceReminders(String(id), title.trim(), dueDate, formatARS(amountCents));
            }

            Alert.alert("Guardado", "Servicio actualizado");
            router.back();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!service) return;
        const warn = service.status === "paid" && service.linkedExpenseId
            ? "\n\nEste servicio ya está pagado y tiene un gasto vinculado; no se borrará el gasto."
            : "";
        Alert.alert("Eliminar", `¿Eliminar este servicio?${warn}`, [
            { text: "Cancelar" },
            {
                text: "Eliminar", style: "destructive", onPress: async () => {
                    try {
                        await cancelServiceReminders(String(id));
                        // usamos deleteService si preferís borrado real; si querés archivar, lo cambiamos después
                        await deleteService(String(projectId), String(id));
                        router.replace({ pathname: "/services", params: { projectId: String(projectId) } });
                    } catch (e: any) {
                        Alert.alert("Error", e?.message ?? "No se pudo eliminar");
                    }
                }
            }
        ]);
    }

    if (loading || !service) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8 }}>Cargando…</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Editar servicio</Text>

            {service.status === "paid" && (
                <View style={{ backgroundColor: "#064e3b", borderColor: "#065f46", borderWidth: 1, padding: 10, borderRadius: 10 }}>
                    <Text style={{ color: "#a7f3d0" }}>
                        Pagado el {service.paidAt ? new Date(service.paidAt as any).toLocaleDateString() : "-"} • {service.paidByName || "—"}
                    </Text>
                </View>
            )}

            <Text>Tipo</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SERVICE_TYPES.map((t) => (
                    <Pressable key={t} onPress={() => setType(t)} style={{
                        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                        borderColor: type === t ? "#60a5fa" : "#333",
                        backgroundColor: type === t ? "#1e293b" : "#111",
                    }}>
                        <Text style={{ color: "#fff" }}>{t}</Text>
                    </Pressable>
                ))}
            </View>

            <Text>Título</Text>
            <TextInput value={title} onChangeText={setTitle} style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }} />

            <Text>Importe (ARS)</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }} />

            <Text>Vencimiento</Text>
            <Pressable
                onPress={() => setShowDuePicker(true)}
                style={{ backgroundColor: "#111", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#333" }}
            >
                <Text style={{ color: "#fff" }}>{dueDate.toLocaleDateString()}</Text>
                <Text style={{ color: "#aaa", marginTop: 4 }}>Tocar para elegir fecha</Text>
            </Pressable>
            {showDuePicker && (
                <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onChangeDue}
                />
            )}

            <Text>Asignado a (opcional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable onPress={() => selectAssigned(undefined)} style={{
                    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                    borderColor: !assignedToUid ? "#60a5fa" : "#333",
                    backgroundColor: !assignedToUid ? "#1e293b" : "#111",
                }}>
                    <Text style={{ color: "#fff" }}>Nadie</Text>
                </Pressable>
                {members.map((m) => {
                    const name = (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;
                    const active = assignedToUid === m.uid;
                    return (
                        <Pressable key={m.uid} onPress={() => selectAssigned(m.uid)} style={{
                            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                            borderColor: active ? "#60a5fa" : "#333",
                            backgroundColor: active ? "#1e293b" : "#111",
                        }}>
                            <Text style={{ color: "#fff" }}>{name}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text>Descripción (opcional)</Text>
            <TextInput
                value={description}
                onChangeText={setDescription}
                multiline numberOfLines={3} maxLength={250}
                style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10, textAlignVertical: "top" }}
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Pressable onPress={onSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2563eb", padding: 14, borderRadius: 12, alignItems: "center", opacity: saving ? 0.8 : 1 }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{saving ? "Guardando…" : "Guardar"}</Text>
                </Pressable>
                <Pressable onPress={onDelete} style={{ width: 120, backgroundColor: "#ef4444", padding: 14, borderRadius: 12, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Eliminar</Text>
                </Pressable>
            </View>
        </View>
    );
}
