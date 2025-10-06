// app/services/new.tsx
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { getStoredUser } from "../../src/auth-storage";
import { scheduleServiceReminders } from "../../src/notifications/services-reminders";
import { subscribeProjectMembers, type ProjectMember } from "../../src/services/members.read";
import { createService, type ServiceInput } from "../../src/services/services";
import { formatARS, toCents } from "../../src/utils/money";

const SERVICE_TYPES = ["Luz", "Gas", "Agua", "Cuota IPV", "Resumen tarjeta", "custom"] as const;
type ServiceType = typeof SERVICE_TYPES[number];

export default function NewService() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    const [type, setType] = useState<ServiceType>("Luz");
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");

    const [dueDate, setDueDate] = useState(new Date());
    const [showDuePicker, setShowDuePicker] = useState(false);

    const [description, setDescription] = useState("");
    const [assignedToUid, setAssignedToUid] = useState<string | undefined>(undefined);
    const [assignedToName, setAssignedToName] = useState<string | undefined>(undefined);

    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLoadingMembers(true);
        return subscribeProjectMembers(String(projectId), (arr) => {
            setMembers(arr || []);
            setLoadingMembers(false);
        });
    }, [projectId]);

    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) => map.set(m.uid, (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`));
        return map;
    }, [members]);

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
        // En Android el picker es modal: cerrar siempre al cambiar/cancelar
        if (Platform.OS === "android") setShowDuePicker(false);
        // Solo setear si el usuario confirmó (event.type === 'set')
        if (event.type === "set" && date) {
            setDueDate(date);
        }
        // En iOS podríamos dejarlo abierto (inline), pero para UX consistente lo cerramos al elegir:
        if (Platform.OS === "ios" && event.type === "set") setShowDuePicker(false);
    }

    async function onSave() {
        const amountCents = toCents(amount);
        if (!title || title.trim().length < 3) return Alert.alert("Título muy corto");
        if (amountCents <= 0) return Alert.alert("Importe inválido");
        if (!dueDate) return Alert.alert("Falta fecha de vencimiento");

        const user = await getStoredUser();
        if (!user) return Alert.alert("Sesión no encontrada");

        try {
            setSaving(true);

            const input: ServiceInput = {
                type,
                title: title.trim(),
                amountCents,
                dueDate,
                description: description?.trim() ? description.trim().slice(0, 250) : undefined,
                createdByUid: user.uid,
                createdByName: user.displayName || user.email || "Usuario",
                assignedToUid,
                assignedToName,
            };

            const id = await createService(String(projectId), input);

            // Programar notificaciones locales
            await scheduleServiceReminders(id, input.title, input.dueDate, formatARS(input.amountCents));

            router.replace({ pathname: "/services", params: { projectId: String(projectId) } });
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo crear el servicio");
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Nuevo servicio</Text>

            <Text>Tipo</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SERVICE_TYPES.map((t) => (
                    <Pressable
                        key={t}
                        onPress={() => setType(t)}
                        style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: type === t ? "#60a5fa" : "#333",
                            backgroundColor: type === t ? "#1e293b" : "#111",
                        }}
                    >
                        <Text style={{ color: "#fff" }}>{t}</Text>
                    </Pressable>
                ))}
            </View>

            <Text>Título</Text>
            <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ej: Luz – Octubre"
                placeholderTextColor="#666"
                style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }}
            />

            <Text>Importe (ARS)</Text>
            <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Ej: 12345.67"
                placeholderTextColor="#666"
                style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }}
            />

            <Text>Vencimiento</Text>
            <View style={{ gap: 8 }}>
                <Pressable
                    onPress={() => setShowDuePicker(true)}
                    style={{
                        backgroundColor: "#111",
                        borderRadius: 10,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: "#333",
                    }}
                >
                    <Text style={{ color: "#fff" }}>
                        {dueDate.toLocaleDateString()}
                    </Text>
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
            </View>

            <Text>Asignado a (opcional)</Text>
            {loadingMembers ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={{ color: "#aaa" }}>Cargando miembros…</Text>
                </View>
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pressable
                        onPress={() => selectAssigned(undefined)}
                        style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: !assignedToUid ? "#60a5fa" : "#333",
                            backgroundColor: !assignedToUid ? "#1e293b" : "#111",
                        }}
                    >
                        <Text style={{ color: "#fff" }}>Nadie</Text>
                    </Pressable>

                    {members.map((m) => {
                        const name = (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;
                        const active = assignedToUid === m.uid;
                        return (
                            <Pressable
                                key={m.uid}
                                onPress={() => selectAssigned(m.uid)}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: active ? "#60a5fa" : "#333",
                                    backgroundColor: active ? "#1e293b" : "#111",
                                }}
                            >
                                <Text style={{ color: "#fff" }}>{name}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            )}

            <Text>Descripción (opcional)</Text>
            <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholder="Hasta 250 caracteres"
                placeholderTextColor="#666"
                maxLength={250}
                style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10, textAlignVertical: "top" }}
            />
            <Text style={{ color: "#aaa", alignSelf: "flex-end" }}>{description.length}/250</Text>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Pressable
                    onPress={onSave}
                    disabled={saving}
                    style={{ flex: 1, backgroundColor: "#2563eb", padding: 14, borderRadius: 12, alignItems: "center", opacity: saving ? 0.8 : 1 }}
                >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{saving ? "Guardando…" : "Guardar"}</Text>
                </Pressable>
                <Pressable onPress={() => router.back()} style={{ width: 120, backgroundColor: "#374151", padding: 14, borderRadius: 12, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Cancelar</Text>
                </Pressable>
            </View>
        </View>
    );
}
