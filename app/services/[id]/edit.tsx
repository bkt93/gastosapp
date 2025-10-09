// app/services/[id]/edit.tsx — Editar servicio (UI alineada a Expenses)
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import { db } from "../../../src/firebase";
import {
    cancelServiceReminders,
    scheduleServiceReminders,
} from "../../../src/notifications/services-reminders";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../../src/services/members.read";
import {
    deleteService,
    updateService,
    type Service,
} from "../../../src/services/services";
import { colors, radius, spacing } from "../../../src/theme";
import { formatARS, toCents } from "../../../src/utils/money";

/** ===== Categorías con ícono (podés mover a un constants/ si querés) ===== */
const SERVICE_CATEGORIES = [
    { key: "Luz", label: "Luz", icon: "💡" },
    { key: "Gas", label: "Gas", icon: "🔥" },
    { key: "Agua", label: "Agua", icon: "💧" },
    { key: "Cuota IPV", label: "Cuota IPV", icon: "🏠" },
    { key: "Resumen tarjeta", label: "Resumen tarjeta", icon: "💳" },
    { key: "custom", label: "Personalizado", icon: "🧩" },
] as const;
type ServiceType = typeof SERVICE_CATEGORIES[number]["key"];

/** ===== Utils ===== */
function toJSDate(x: any): Date {
    if (x instanceof Date) return x;
    if (x?.toDate) return x.toDate();
    if (typeof x === "number") return new Date(x);
    if (typeof x === "string") return new Date(x);
    return new Date();
}

/** ===== Chip reutilizable ===== */
function PillChip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.card : colors.cardAlt,
                opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Text style={{ color: colors.text, fontWeight: selected ? "700" : "500" }}>
                {label}
            </Text>
        </Pressable>
    );
}

/** ===== Select de categoría con ícono (embebido) ===== */
function ServiceCategorySelect({
    value,
    onChange,
}: {
    value: ServiceType;
    onChange: (v: ServiceType) => void;
}) {
    const current =
        SERVICE_CATEGORIES.find((c) => c.key === value) ?? SERVICE_CATEGORIES[0];
    const [open, setOpen] = useState(false);

    return (
        <View>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                Categoría
            </Text>
            <Pressable
                onPress={() => setOpen(true)}
                style={{
                    backgroundColor: colors.cardAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingVertical: 12,
                    paddingHorizontal: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <Text style={{ fontSize: 18 }}>{current.icon}</Text>
                <Text style={{ color: colors.text }}>{current.label}</Text>
            </Pressable>

            {open && (
                <View
                    style={{
                        marginTop: spacing.sm,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.lg,
                        overflow: "hidden",
                    }}
                >
                    {SERVICE_CATEGORIES.map((opt, idx) => {
                        const selected = value === opt.key;
                        return (
                            <Pressable
                                key={opt.key}
                                onPress={() => {
                                    onChange(opt.key);
                                    setOpen(false);
                                }}
                                style={({ pressed }) => ({
                                    paddingVertical: 12,
                                    paddingHorizontal: spacing.md,
                                    backgroundColor: pressed ? colors.cardAlt : "transparent",
                                    borderTopWidth: idx === 0 ? 0 : 1,
                                    borderTopColor: colors.border,
                                    flexDirection: "row",
                                    alignItems: "center",
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
            )}
        </View>
    );
}

/** ===== Pantalla ===== */
export default function EditService() {
    const { id, projectId, projectName } = useLocalSearchParams<{
        id: string;
        projectId: string;
        projectName?: string;
    }>();
    const router = useRouter();

    // estado del doc
    const [service, setService] = useState<Service | null>(null);
    const [loadingDoc, setLoadingDoc] = useState(true);
    const [saving, setSaving] = useState(false);

    // campos editables
    const [type, setType] = useState<ServiceType>("Luz");
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [dueDate, setDueDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [description, setDescription] = useState("");
    const [assignedToUid, setAssignedToUid] = useState<string | undefined>(undefined);
    const [assignedToName, setAssignedToName] = useState<string | undefined>(undefined);

    // miembros
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    if (!projectId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <AppHeader onPressLeft={() => router.back()} leftIcon="chevron-back" title="Editar servicio" />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
                    <Text style={{ color: colors.text }}>Falta projectId</Text>
                </View>
            </SafeAreaView>
        );
    }

    // cargar servicio
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const ref = doc(db, "projects", String(projectId), "services", String(id));
                const snap = await getDoc(ref);
                const d: any = snap.data();
                if (!d) throw new Error("No encontrado");
                if (!mounted) return;

                const s: Service = {
                    id: snap.id,
                    ...d,
                    dueDate: toJSDate(d.dueDate),
                    createdAt: toJSDate(d.createdAt),
                    updatedAt: toJSDate(d.updatedAt),
                };
                setService(s);

                setType((s.type as ServiceType) || "Luz");
                setTitle(s.title || "");
                setAmount(String((s.amountCents ?? 0) / 100));
                setDueDate(s.dueDate);
                setDescription(s.description || "");
                setAssignedToUid(s.assignedToUid);
                setAssignedToName(s.assignedToName);
            } catch (e) {
                Alert.alert("Error", "No se pudo cargar el servicio");
            } finally {
                if (mounted) setLoadingDoc(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id, projectId]);

    // miembros
    useEffect(() => {
        setLoadingMembers(true);
        const unsub = subscribeProjectMembers(String(projectId), (arr) => {
            setMembers(arr || []);
            setLoadingMembers(false);
        });
        return unsub;
    }, [projectId]);

    const displayNameOf = (m: ProjectMember) =>
        (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;

    const memberChips = useMemo(() => {
        if (!service) return [];
        const chips = members.map((m) => ({ uid: m.uid, name: displayNameOf(m) }));
        // fallback por si el pagado/asignado no está en la lista actual
        if (assignedToUid && !chips.some((c) => c.uid === assignedToUid)) {
            chips.unshift({
                uid: assignedToUid,
                name: assignedToName || `Miembro ${assignedToUid.slice(0, 6)}`,
            });
        }
        return chips;
    }, [members, service, assignedToUid, assignedToName]);

    const canSave = useMemo(() => {
        const amountCents = toCents(amount);
        return title.trim().length >= 3 && amountCents > 0 && !!dueDate;
    }, [title, amount, dueDate]);

    async function onSave() {
        const amountCents = toCents(amount);
        if (!canSave) {
            if (title.trim().length < 3) return Alert.alert("Título muy corto");
            if (amountCents <= 0) return Alert.alert("Importe inválido");
            return;
        }

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

            // reprogramar notis si cambió la fecha
            if (service && +service.dueDate !== +dueDate) {
                await cancelServiceReminders(String(id));
                await scheduleServiceReminders(String(id), title.trim(), dueDate, formatARS(amountCents));
            }

            router.back();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!service) return;
        const warn =
            service.status === "paid" && service.linkedExpenseId
                ? "\n\nEste servicio ya está pagado y tiene un gasto vinculado; no se borrará el gasto."
                : "";
        Alert.alert("Eliminar", `¿Eliminar este servicio?${warn}`, [
            { text: "Cancelar" },
            {
                text: "Eliminar",
                style: "destructive",
                onPress: async () => {
                    try {
                        await cancelServiceReminders(String(id));
                        await deleteService(String(projectId), String(id));
                        router.replace({
                            pathname: "/services",
                            params: { projectId: String(projectId) },
                        });
                    } catch (e: any) {
                        Alert.alert("Error", e?.message ?? "No se pudo eliminar");
                    }
                },
            },
        ]);
    }

    if (loadingDoc || !service) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <Stack.Screen options={{ headerShown: false }} />
                <AppHeader onPressLeft={() => router.back()} leftIcon="chevron-back" title="Editar servicio" />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <ActivityIndicator color={colors.text} />
                    <Text style={{ color: colors.textMuted }}>Cargando…</Text>
                </View>
            </SafeAreaView>
        );
    }

    const helpTitleTooShort = title.trim().length > 0 && title.trim().length < 3;
    const helpAmountInvalid = amount.length > 0 && toCents(amount) <= 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            <AppHeader
                onPressLeft={() => router.back()}
                leftIcon="chevron-back"
                title="Editar servicio"
                subtitle={typeof projectName === "string" ? projectName : undefined}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.select({ ios: "padding", android: undefined })}
            >
                <ScrollView
                    contentContainerStyle={{
                        paddingHorizontal: spacing.lg,
                        paddingTop: spacing.md,
                        paddingBottom: 120,
                        gap: spacing.md,
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Banner estado pagado */}
                    {service.status === "paid" && (
                        <View
                            style={{
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: radius.lg,
                                padding: spacing.md,
                            }}
                        >
                            <Text style={{ color: colors.text, fontWeight: "700" }}>Pagado</Text>
                            <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                                {`El ${service.paidAt ? new Date(service.paidAt as any).toLocaleDateString("es-AR") : "-"} • ${service.paidByName || "—"}`}
                            </Text>
                        </View>
                    )}

                    {/* Categoría */}
                    <ServiceCategorySelect value={type} onChange={setType} />

                    {/* Título */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Título
                        </Text>
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
                                borderRadius: radius.lg,
                                padding: 12,
                            }}
                            returnKeyType="next"
                        />
                        {helpTitleTooShort && (
                            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                                Usá al menos 3 caracteres.
                            </Text>
                        )}
                    </View>

                    {/* Importe */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Importe (ARS)
                        </Text>
                        <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                            placeholder="0,00"
                            placeholderTextColor={colors.textMuted}
                            style={{
                                color: colors.text,
                                backgroundColor: colors.cardAlt,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: radius.lg,
                                padding: 12,
                            }}
                        />
                        {helpAmountInvalid && (
                            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                                Ingresá un importe válido mayor a 0.
                            </Text>
                        )}
                    </View>

                    {/* Vencimiento */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Vence
                        </Text>
                        <Pressable
                            onPress={() => setShowPicker(true)}
                            style={({ pressed }) => ({
                                backgroundColor: colors.cardAlt,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: radius.lg,
                                padding: 12,
                                opacity: pressed ? 0.85 : 1,
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Elegir fecha de vencimiento"
                        >
                            <Text style={{ color: colors.text }}>
                                {new Intl.DateTimeFormat("es-AR").format(dueDate)}
                            </Text>
                        </Pressable>

                        {showPicker && (
                            <DateTimePicker
                                value={dueDate}
                                mode="date"
                                display="default"
                                onChange={(_, d) => {
                                    setShowPicker(false);
                                    if (d) setDueDate(d);
                                }}
                            />
                        )}
                    </View>

                    {/* Asignado a */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Asignado a (opcional)
                        </Text>
                        {loadingMembers ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <ActivityIndicator color={colors.text} />
                                <Text style={{ color: colors.textMuted }}>Cargando miembros…</Text>
                            </View>
                        ) : memberChips.length === 0 ? (
                            <Text style={{ color: colors.textMuted }}>No hay miembros en el proyecto.</Text>
                        ) : (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                                <PillChip
                                    label="Nadie"
                                    selected={!assignedToUid}
                                    onPress={() => {
                                        setAssignedToUid(undefined);
                                        setAssignedToName(undefined);
                                    }}
                                />
                                {memberChips.map((m) => (
                                    <PillChip
                                        key={m.uid}
                                        label={m.name}
                                        selected={assignedToUid === m.uid}
                                        onPress={() => {
                                            setAssignedToUid(m.uid);
                                            setAssignedToName(m.name);
                                        }}
                                    />
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Descripción */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Descripción (opcional)
                        </Text>
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
                                borderRadius: radius.lg,
                                padding: 12,
                                minHeight: 90,
                                textAlignVertical: "top",
                            }}
                        />
                        <Text style={{ color: colors.textMuted, alignSelf: "flex-end", marginTop: 4 }}>
                            {description.length}/250
                        </Text>
                    </View>

                    {/* Acciones */}
                    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                        <Pressable
                            onPress={onSave}
                            disabled={saving || !canSave}
                            style={({ pressed }) => ({
                                flex: 1,
                                backgroundColor: saving || !canSave ? colors.textMuted : colors.primary,
                                padding: 14,
                                borderRadius: radius.xl,
                                alignItems: "center",
                                opacity: pressed ? 0.85 : 1,
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Guardar cambios"
                        >
                            <Text style={{ color: "white", fontWeight: "700" }}>
                                {saving ? "Guardando…" : "Guardar"}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={onDelete}
                            style={({ pressed }) => ({
                                width: 120,
                                padding: 14,
                                borderRadius: radius.xl,
                                alignItems: "center",
                                backgroundColor: "#ef4444",
                                opacity: pressed ? 0.85 : 1,
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Eliminar servicio"
                        >
                            <Text style={{ color: "white", fontWeight: "700" }}>Eliminar</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
