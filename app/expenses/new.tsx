// app/expenses/new.tsx — Crear gasto (UI unificada con Home)
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
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

import { CATEGORIES } from "../../constants/categories";
import { createExpense } from "../../src/services/expenses";
import { toCents } from "../../src/utils/money";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../src/firebase";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";

// UI tokens y componentes compartidos
import { Stack } from "expo-router";
import AppHeader from "../../src/components/AppHeader";
import { colors, radius, spacing } from "../../src/theme";

import { type Category } from "../../constants/categories";
import CategorySelect from "../../src/components/CategorySelect";

// extender para permitir displayName opcional
type PM = ProjectMember & { displayName?: string | null };

// Chip reutilizable (categorías/miembros)
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

export default function NewExpense() {
    // --- params ---
    const { projectId, projectName } = useLocalSearchParams<{
        projectId: string;
        projectName?: string;
    }>();

    if (!projectId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <StatusBar barStyle="light-content" />
                <AppHeader
                    onPressLeft={() => router.back()}
                    leftIcon="chevron-back"
                    title="Nuevo gasto"
                />
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: spacing.lg,
                    }}
                >
                    <Text style={{ color: colors.text }}>Falta projectId</Text>
                </View>
            </SafeAreaView>
        );
    }

    // --- form state ---
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    // --- members state ---
    const [authUid, setAuthUid] = useState<string | null>(null);
    const [members, setMembers] = useState<PM[]>([]);
    const [category, setCategory] = useState<Category>(CATEGORIES[0]);

    const options = useMemo(
        () =>
            members.map((m) => ({
                uid: m.uid,
                name:
                    m.displayName ??
                    (m.uid === authUid
                        ? auth.currentUser?.displayName ?? "Vos"
                        : `Miembro ${m.uid.slice(0, 6)}`),
            })),
        [members, authUid]
    );
    const [paidByUid, setPaidByUid] = useState<string>("");
    const [paidByName, setPaidByName] = useState<string>("");

    // --- quién soy ---
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setAuthUid(u?.uid ?? null));
        return () => unsub();
    }, []);

    // --- miembros del proyecto (subcolección) ---
    useEffect(() => {
        return subscribeProjectMembers(String(projectId), (rows) =>
            setMembers(rows as PM[])
        );
    }, [projectId]);

    // --- default pagador: yo si estoy, si no el primero de la lista ---
    useEffect(() => {
        if (paidByUid || options.length === 0) return;
        const mine = authUid ? options.find((o) => o.uid === authUid) : undefined;
        const def = mine ?? options[0];
        if (!def) return;
        setPaidByUid(def.uid);
        setPaidByName(def.name);
    }, [authUid, options, paidByUid]);

    const canSave = useMemo(() => {
        const amountCents = toCents(amount);
        return title.trim().length >= 3 && amountCents > 0 && !!paidByUid;
    }, [title, amount, paidByUid]);

    // --- save ---
    async function onSave() {
        const amountCents = toCents(amount);
        if (title.trim().length < 3) return; // validación visual, no alert
        if (amountCents <= 0) return; // validación visual, no alert
        if (!paidByUid) return; // validación visual, no alert

        try {
            setSaving(true);
            await createExpense(String(projectId), {
                title: title.trim(),
                category,
                amountCents,
                paidByUid,
                paidByName, // guarda el nombre mostrado
                date,
            });
            router.back();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    }

    // --- UI ---
    const helpTitleTooShort = title.trim().length > 0 && title.trim().length < 3;
    const helpAmountInvalid = amount.length > 0 && toCents(amount) <= 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>


            <Stack.Screen options={{ headerShown: false }} />


            <StatusBar barStyle="light-content" />
            <AppHeader
                onPressLeft={() => router.back()}
                leftIcon="chevron-back"
                title="Nuevo gasto"
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
                        paddingBottom: 120, // que no choque con el borde inferior/teclado
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
                        {options.length === 0 ? (
                            <Text style={{ color: colors.textMuted }}>Cargando miembros…</Text>
                        ) : (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                                {options.map((m) => (
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

                    {/* Fecha */}
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

                    {/* Guardar */}
                    <Pressable
                        onPress={onSave}
                        disabled={saving || !canSave}
                        style={({ pressed }) => ({
                            marginTop: spacing.sm,
                            backgroundColor:
                                saving || !canSave ? colors.textMuted : colors.primary,
                            padding: 14,
                            borderRadius: radius.xl,
                            alignItems: "center",
                            opacity: pressed ? 0.85 : 1,
                        })}
                        accessibilityRole="button"
                        accessibilityLabel="Guardar gasto"
                    >
                        <Text style={{ color: "white", fontWeight: "700" }}>
                            {saving ? "Guardando…" : "Guardar"}
                        </Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
