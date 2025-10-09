// app/expenses/[id]/edit.tsx — Editar / Eliminar (UI unificada + fecha editable)
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "../../../src/firebase";
import { deleteExpense, updateExpense } from "../../../src/services/expenses";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../../src/services/members.read";
import { toCents } from "../../../src/utils/money";

import {
    CATEGORIES,
    type Category,
} from "../../../constants/categories";
import AppHeader from "../../../src/components/AppHeader";
import CategorySelect from "../../../src/components/CategorySelect";
import { colors, radius, spacing } from "../../../src/theme";

// Chip reutilizable (miembros)
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

// Convierte lo que venga de Firestore a Date
function toJSDate(x: any): Date {
    if (x instanceof Date) return x;
    if (x?.toDate) return x.toDate();
    if (typeof x === "number") return new Date(x);
    if (typeof x === "string") return new Date(x);
    return new Date();
}

export default function EditExpense() {
    const { id, projectId, projectName } = useLocalSearchParams<{
        id: string;
        projectId: string;
        projectName?: string;
    }>();

    // --- state del doc ---
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<Category>(CATEGORIES[0]);
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    const [paidByUid, setPaidByUid] = useState<string>("");
    const [paidByName, setPaidByName] = useState<string>("");

    const [loadingDoc, setLoadingDoc] = useState(true);
    const [saving, setSaving] = useState(false);

    // --- miembros ---
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    if (!projectId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <StatusBar barStyle="light-content" />
                <AppHeader
                    onPressLeft={() => router.back()}
                    leftIcon="chevron-back"
                    title="Editar gasto"
                />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
                    <Text style={{ color: colors.text }}>Falta projectId</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Cargar gasto
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const ref = doc(db, "projects", String(projectId), "expenses", String(id));
                const snap = await getDoc(ref);
                const data: any = snap.data();
                if (data && mounted) {
                    setTitle(data.title ?? "");
                    setCategory((data.category as Category) ?? CATEGORIES[0]);
                    setAmount(String((data.amountCents ?? 0) / 100));
                    setPaidByUid(data.paidByUid ?? "");
                    setPaidByName(data.paidByName ?? "");
                    setDate(toJSDate(data.date));
                }
            } catch (e) {
                Alert.alert("Error", "No se pudo cargar el gasto");
            } finally {
                if (mounted) setLoadingDoc(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id, projectId]);

    // Suscribirse a miembros
    useEffect(() => {
        setLoadingMembers(true);
        const unsub = subscribeProjectMembers(String(projectId), (arr) => {
            setMembers(arr || []);
            setLoadingMembers(false);
        });
        return unsub;
    }, [projectId]);

    // Helper para nombre visible
    const displayNameOf = (m: ProjectMember) =>
        (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;

    // Chips de miembros (+ fallback)
    const memberChips = useMemo(() => {
        const chips = members.map((m) => ({ uid: m.uid, name: displayNameOf(m) }));
        if (paidByUid && !chips.some((c) => c.uid === paidByUid)) {
            chips.unshift({ uid: paidByUid, name: paidByName || `Miembro ${paidByUid.slice(0, 6)}` });
        }
        return chips;
    }, [members, paidByUid, paidByName]);

    const canSave = useMemo(() => {
        const amountCents = toCents(amount);
        return title.trim().length >= 3 && amountCents > 0 && !!paidByUid && !!paidByName;
    }, [title, amount, paidByUid, paidByName]);

    async function onSave() {
        const amountCents = toCents(amount);
        if (!canSave) return;

        try {
            setSaving(true);
            await updateExpense(String(projectId), String(id), {
                title: title.trim(),
                category,
                amountCents,
                paidByUid,
                paidByName,
                date, // <-- ahora también se actualiza la fecha
            });
            router.back();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        Alert.alert("Eliminar", "¿Querés eliminar este gasto?", [
            { text: "Cancelar" },
            {
                text: "Eliminar",
                style: "destructive",
                onPress: async () => {
                    await deleteExpense(String(projectId), String(id));
                    router.replace({ pathname: "/expenses", params: { projectId: String(projectId) } });
                },
            },
        ]);
    }

    if (loadingDoc) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <StatusBar barStyle="light-content" />
                <AppHeader
                    onPressLeft={() => router.back()}
                    leftIcon="chevron-back"
                    title="Editar gasto"
                    subtitle={typeof projectName === "string" ? projectName : undefined}
                />
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <ActivityIndicator />
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
            <StatusBar barStyle="light-content" />
            <AppHeader
                onPressLeft={() => router.back()}
                leftIcon="chevron-back"
                title="Editar gasto"
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
                    {/* Título */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Título
                        </Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Por ejemplo, Bebidas"
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

                    {/* Categoría (Select con emojis) */}
                    <CategorySelect value={category} onChange={setCategory} />

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

                    {/* Pagado por */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Pagado por
                        </Text>
                        {loadingMembers ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <ActivityIndicator />
                                <Text style={{ color: colors.textMuted }}>Cargando miembros…</Text>
                            </View>
                        ) : memberChips.length === 0 ? (
                            <Text style={{ color: colors.textMuted }}>No hay miembros en el proyecto.</Text>
                        ) : (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                                {memberChips.map((m) => (
                                    <PillChip
                                        key={m.uid}
                                        label={m.name}
                                        selected={paidByUid === m.uid}
                                        onPress={() => {
                                            setPaidByUid(m.uid);
                                            setPaidByName(m.name);
                                        }}
                                    />
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Fecha (editable) */}
                    <View>
                        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                            Fecha
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
                            accessibilityLabel="Elegir fecha"
                        >
                            <Text style={{ color: colors.text }}>
                                {date.toLocaleDateString()}
                            </Text>
                        </Pressable>

                        {showPicker && (
                            <DateTimePicker
                                value={date}
                                mode="date"
                                display="default"
                                onChange={(_, d) => {
                                    setShowPicker(false);
                                    if (d) setDate(d);
                                }}
                            />
                        )}
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
                                backgroundColor: "#ef4444", // si luego sumás colors.danger, reemplazar
                                opacity: pressed ? 0.85 : 1,
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Eliminar gasto"
                        >
                            <Text style={{ color: "white", fontWeight: "700" }}>Eliminar</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
