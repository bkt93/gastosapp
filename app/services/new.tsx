// app/services/new.tsx — Nueva UI: select de categoría con ícono, chips de miembros, date picker
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getStoredUser } from "../../src/auth-storage";
import AppHeader from "../../src/components/AppHeader";
import { scheduleServiceReminders } from "../../src/notifications/services-reminders";
import { subscribeProjectMembers, type ProjectMember } from "../../src/services/members.read";
import { createService, type ServiceInput } from "../../src/services/services";
import { colors, radius, spacing } from "../../src/theme";
import { formatARS, toCents } from "../../src/utils/money";

// 🔧 Catálogo de categorías con ícono (editá a gusto)
const SERVICE_CATEGORIES = [
    { key: "Luz", label: "Luz", icon: "💡" },
    { key: "Gas", label: "Gas", icon: "🔥" },
    { key: "Agua", label: "Agua", icon: "💧" },
    { key: "Cuota IPV", label: "Cuota IPV", icon: "🏠" },
    { key: "Resumen tarjeta", label: "Resumen tarjeta", icon: "💳" },
    { key: "custom", label: "Personalizado", icon: "🧩" },
] as const;
type ServiceType = typeof SERVICE_CATEGORIES[number]["key"];

export default function NewService() {
    const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName?: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    // Estado
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

    const router = useRouter();

    // Modal de categoría
    const [showTypeModal, setShowTypeModal] = useState(false);

    // Miembros
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
        if (Platform.OS === "android") setShowDuePicker(false);
        if (event.type === "set" && date) setDueDate(date);
        if (Platform.OS === "ios" && event.type === "set") setShowDuePicker(false);
    }

    const selectedType = SERVICE_CATEGORIES.find((c) => c.key === type) ?? SERVICE_CATEGORIES[0];
    const canSave =
        title.trim().length >= 3 && toCents(amount) > 0 && !!dueDate && !!projectId;

    async function onSave() {
        const amountCents = toCents(amount);
        if (!canSave) {
            if (title.trim().length < 3) return Alert.alert("Título muy corto");
            if (amountCents <= 0) return Alert.alert("Importe inválido");
            if (!dueDate) return Alert.alert("Falta fecha de vencimiento");
            return;
        }

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

            // Notificaciones locales
            await scheduleServiceReminders(id, input.title, input.dueDate, formatARS(input.amountCents));
            
            router.replace({ pathname: "/services", params: { projectId: String(projectId) } });
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo crear el servicio");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            <AppHeader
                onPressLeft={() => router.back?.()}
                leftIcon="chevron-back"
                title="Nuevo servicio"
                subtitle={projectName ?? undefined}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.select({ ios: "padding", android: undefined })}
            >
                <ScrollView
                    contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl * 4 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ==== CATEGORÍA (select con ícono) ==== */}
                    <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Categoría</Text>
                    <Pressable
                        onPress={() => setShowTypeModal(true)}
                        style={{
                            backgroundColor: colors.cardAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingVertical: 12,
                            paddingHorizontal: spacing.md,
                            marginBottom: spacing.md,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Text style={{ fontSize: 18 }}>{selectedType.icon}</Text>
                        <Text style={{ color: colors.text }}>{selectedType.label}</Text>
                    </Pressable>

                    {/* ==== TÍTULO ==== */}
                    <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Título</Text>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ej: Luz — Octubre"
                        placeholderTextColor={colors.textMuted}
                        style={{
                            color: colors.text,
                            backgroundColor: colors.cardAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: spacing.md,
                        }}
                    />

                    {/* ==== IMPORTE ==== */}
                    <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Importe</Text>
                    <TextInput
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        placeholder="$ 0,00"
                        placeholderTextColor={colors.textMuted}
                        style={{
                            color: colors.text,
                            backgroundColor: colors.cardAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: spacing.xs,
                        }}
                    />
                    {toCents(amount) > 0 && (
                        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
                            {formatARS(toCents(amount))}
                        </Text>
                    )}

                    {/* ==== VENCIMIENTO ==== */}
                    <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Vence</Text>
                    <Pressable
                        onPress={() => setShowDuePicker(true)}
                        style={{
                            backgroundColor: colors.cardAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: spacing.md,
                        }}
                    >
                        <Text style={{ color: colors.text }}>
                            {new Intl.DateTimeFormat("es-AR").format(dueDate)}
                        </Text>
                        <Text style={{ color: colors.textMuted, marginTop: 4 }}>Tocar para elegir fecha</Text>
                    </Pressable>
                    {showDuePicker && (
                        <DateTimePicker
                            value={dueDate}
                            mode="date"
                            display={Platform.OS === "ios" ? "inline" : "default"}
                            onChange={onChangeDue}
                        />
                    )}

                    {/* ==== ASIGNADO A ==== */}
                    <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Asignado a</Text>
                    {loadingMembers ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md }}>
                            <ActivityIndicator color={colors.text} />
                            <Text style={{ color: colors.textMuted }}>Cargando miembros…</Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md }}>
                            <Pill
                                label="Nadie"
                                selected={!assignedToUid}
                                onPress={() => selectAssigned(undefined)}
                            />
                            {members.map((m) => {
                                const name = (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;
                                const active = assignedToUid === m.uid;
                                return (
                                    <Pill
                                        key={m.uid}
                                        label={name}
                                        selected={active}
                                        onPress={() => selectAssigned(m.uid)}
                                    />
                                );
                            })}
                        </View>
                    )}

                    {/* ==== DESCRIPCIÓN ==== */}
                    <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Descripción (opcional)</Text>
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        maxLength={250}
                        placeholder="Hasta 250 caracteres"
                        placeholderTextColor={colors.textMuted}
                        style={{
                            color: colors.text,
                            backgroundColor: colors.cardAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            minHeight: 90,
                            textAlignVertical: "top",
                        }}
                    />
                    <Text style={{ color: colors.textMuted, alignSelf: "flex-end", marginTop: 4 }}>
                        {description.length}/250
                    </Text>

                    {/* ==== ACCIONES ==== */}
                    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                        <Pressable
                            onPress={() => router.back?.()}
                            style={({ pressed }) => ({
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.cardAlt,
                                opacity: pressed ? 0.85 : 1,
                            })}
                        >
                            <Text style={{ color: colors.text }}>Cancelar</Text>
                        </Pressable>

                        <Pressable
                            onPress={onSave}
                            disabled={!canSave || saving}
                            style={({ pressed }) => ({
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: "center",
                                backgroundColor: colors.primary,
                                opacity: !canSave || saving || pressed ? 0.6 : 1,
                            })}
                        >
                            <Text style={{ color: "white", fontWeight: "700" }}>
                                {saving ? "Guardando…" : "Guardar"}
                            </Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ==== MODAL CATEGORÍAS ==== */}
            <Modal
                visible={showTypeModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTypeModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
                    <View
                        style={{
                            backgroundColor: colors.card,
                            padding: spacing.lg,
                            borderTopLeftRadius: radius.xl,
                            borderTopRightRadius: radius.xl,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.md }}>
                            Elegir categoría
                        </Text>

                        <View style={{ gap: 8, marginBottom: spacing.lg }}>
                            {SERVICE_CATEGORIES.map((opt) => {
                                const selected = type === opt.key;
                                return (
                                    <Pressable
                                        key={opt.key}
                                        onPress={() => {
                                            setType(opt.key);
                                            setShowTypeModal(false);
                                            // Si es "custom", sugerimos prellenar el título
                                            if (opt.key === "custom" && !title.trim()) setTitle("Servicio");
                                        }}
                                        style={({ pressed }) => ({
                                            paddingVertical: 12,
                                            paddingHorizontal: spacing.md,
                                            borderRadius: 12,
                                            backgroundColor: pressed ? colors.cardAlt : "transparent",
                                            borderWidth: 1,
                                            borderColor: selected ? colors.primary : colors.border,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 10,
                                            justifyContent: "space-between",
                                        })}
                                    >
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                            <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                                            <Text style={{ color: colors.text }}>{opt.label}</Text>
                                        </View>
                                        {selected ? (
                                            <Text style={{ color: colors.primary, fontWeight: "700" }}>✓</Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Pressable
                            onPress={() => setShowTypeModal(false)}
                            style={({ pressed }) => ({
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.cardAlt,
                                opacity: pressed ? 0.85 : 1,
                            })}
                        >
                            <Text style={{ color: colors.text }}>Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function Pill({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.cardAlt : "transparent",
            }}
        >
            <Text style={{ color: colors.text }}>{label}</Text>
        </Pressable>
    );
}
