// src/components/CategorySelect.tsx
import { useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    Text,
    View,
} from "react-native";
import { CATEGORY_OPTIONS, type Category } from "../../constants/categories";
import { colors, radius, spacing } from "../theme";

type Props = {
    value: Category;
    onChange: (val: Category) => void;
    label?: string; // "Categoría"
    placeholder?: string; // "Elegí una categoría"
};

export default function CategorySelect({
    value,
    onChange,
    label = "Categoría",
    placeholder = "Elegí una categoría",
}: Props) {
    const [open, setOpen] = useState(false);
    const current = CATEGORY_OPTIONS.find(o => o.key === value);

    return (
        <View>
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
                {label}
            </Text>

            {/* Trigger */}
            <Pressable
                onPress={() => setOpen(true)}
                style={({ pressed }) => ({
                    backgroundColor: colors.cardAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: pressed ? 0.85 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Abrir selector de categoría"
            >
                {current ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>{current.emoji}</Text>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                            {current.key}
                        </Text>
                    </View>
                ) : (
                    <Text style={{ color: colors.textMuted }}>{placeholder}</Text>
                )}

                {/* Simple caret */}
                <Text style={{ color: colors.textMuted }}>▾</Text>
            </Pressable>

            {/* Modal inferior */}
            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        justifyContent: "flex-end",
                    }}
                >
                    <View
                        style={{
                            backgroundColor: colors.card,
                            padding: spacing.lg,
                            borderTopLeftRadius: radius.xl,
                            borderTopRightRadius: radius.xl,
                            borderWidth: 1,
                            borderColor: colors.border,
                            maxHeight: "70%",
                        }}
                    >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md }}>
                            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                                Elegí una categoría
                            </Text>
                            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar">
                                <Text style={{ color: colors.textMuted }}>Cerrar</Text>
                            </Pressable>
                        </View>

                        <FlatList
                            data={CATEGORY_OPTIONS}
                            keyExtractor={(it) => it.key}
                            ItemSeparatorComponent={() => (
                                <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.6 }} />
                            )}
                            renderItem={({ item }) => {
                                const selected = item.key === value;
                                return (
                                    <Pressable
                                        onPress={() => {
                                            onChange(item.key);
                                            setOpen(false);
                                        }}
                                        style={({ pressed }) => ({
                                            paddingVertical: 12,
                                            paddingHorizontal: 8,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            backgroundColor: pressed ? colors.cardAlt : "transparent",
                                        })}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Seleccionar ${item.key}`}
                                    >
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                            <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                                            <Text style={{ color: colors.text, fontSize: 16 }}>{item.key}</Text>
                                        </View>
                                        {selected && <Text style={{ color: colors.primary }}>●</Text>}
                                    </Pressable>
                                );
                            }}
                            contentContainerStyle={{ paddingBottom: spacing.sm }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
