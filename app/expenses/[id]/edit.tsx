// app/expenses/[id]/edit.tsx — Editar / Eliminar
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { CATEGORIES } from "../../../constants/categories";
import { db } from "../../../src/firebase";
import { deleteExpense, updateExpense } from "../../../src/services/expenses";
import { toCents } from "../../../src/utils/money";

const MEMBERS = [{ uid: "me", name: "Yo" }];


export default function EditExpense() {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<typeof CATEGORIES[number]>(CATEGORIES[0]);
    const [amount, setAmount] = useState("");
    const [paidByUid, setPaidByUid] = useState(MEMBERS[0].uid);
    const [paidByName, setPaidByName] = useState(MEMBERS[0].name);
    const [date] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    useEffect(() => {
        async function load() {
            const snap = await getDoc(doc(db, "projects", String(projectId), "expenses", String(id)));
            const data: any = snap.data();
            if (!data) return;
            setTitle(data.title);
            setCategory(data.category);
            setAmount(String((data.amountCents ?? 0) / 100));
            setPaidByUid(data.paidByUid);
            setPaidByName(data.paidByName);
            setLoading(false);
        }
        load();
    }, [id, projectId]);


    async function onSave() {
        const amountCents = toCents(amount);
        if (title.trim().length < 3) return Alert.alert("Título muy corto");
        if (amountCents <= 0) return Alert.alert("Importe inválido");
        try {
            setSaving(true);
            await updateExpense(String(projectId), String(id), {
                title: title.trim(),
                category,
                amountCents,
                paidByUid,
                paidByName,
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
                text: "Eliminar", style: "destructive", onPress: async () => {
                    await deleteExpense(String(projectId), String(id));
                    router.replace({ pathname: "/expenses", params: { projectId: String(projectId) } });
                }
            }
        ]);
    }


    if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text>Cargando…</Text></View>;


    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Editar gasto</Text>


            <Text>Título</Text>
            <TextInput value={title} onChangeText={setTitle} style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }} />


            <Text>Categoría</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((c) => (
                    <Pressable key={c} onPress={() => setCategory(c)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: category === c ? "#60a5fa" : "#333", backgroundColor: category === c ? "#1e293b" : "#111" }}>
                        <Text style={{ color: "#fff" }}>{c}</Text>
                    </Pressable>
                ))}
            </View>
            <Text>Importe (ARS)</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }} />


            <Text>Pagado por</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
                {MEMBERS.map((m) => (
                    <Pressable key={m.uid} onPress={() => { setPaidByUid(m.uid); setPaidByName(m.name); }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: paidByUid === m.uid ? "#60a5fa" : "#333", backgroundColor: paidByUid === m.uid ? "#1e293b" : "#111" }}>
                        <Text style={{ color: "#fff" }}>{m.name}</Text>
                    </Pressable>
                ))}
            </View>


            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Pressable onPress={onSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2563eb", padding: 14, borderRadius: 12, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{saving ? "Guardando…" : "Guardar"}</Text>
                </Pressable>
                <Pressable onPress={onDelete} style={{ width: 120, backgroundColor: "#ef4444", padding: 14, borderRadius: 12, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Eliminar</Text>
                </Pressable>
            </View>
        </View>
    );
}
