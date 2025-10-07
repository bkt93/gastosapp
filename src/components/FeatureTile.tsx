// src/components/FeatureTile.tsx
import { Pressable, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = {
    icon?: string;            // emoji (💸, 💡) o podría ser un ícono en el futuro
    title: string;            // "Gastos del hogar"
    subtitle?: string;        // "Total mes: $..."
    onPress?: () => void;
};

export default function FeatureTile({ icon, title, subtitle, onPress }: Props) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.92 : 1,
            })}
        >
            {/* Fila superior: Icono + Título + Chevron */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {!!icon && <Text style={{ fontSize: 28, marginRight: 10 }}>{icon}</Text>}
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                        {title}
                    </Text>
                </View>
                {/* Chevron simple (sin libs) */}
                <Text style={{ color: colors.textMuted, fontSize: 22, marginLeft: 8 }}>›</Text>
            </View>

            {/* Fila inferior: subtítulo/KPI */}
            {!!subtitle && (
                <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                    {subtitle}
                </Text>
            )}
        </Pressable>
    );
}
