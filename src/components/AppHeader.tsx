import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

type Props = {
    // Izquierda
    onPressLeft?: () => void;
    leftIcon?: keyof typeof Ionicons.glyphMap;

    // Derecha (compatibilidad con tu API actual)
    onPressRight?: () => void;
    rightIcon?: keyof typeof Ionicons.glyphMap;

    // Centro: logo por defecto, o título/subtítulo si se pasan
    title?: string;
    subtitle?: string;

    // Fuerza mostrar logo aunque haya título (p/escenarios mixtos)
    showLogo?: boolean;
};

export default function AppHeader({
    onPressLeft,
    leftIcon = "chevron-back",
    onPressRight,
    rightIcon = "exit-outline",
    title,
    subtitle,
    showLogo,
}: Props) {
    const insets = useSafeAreaInsets();

    const renderCenter = () => {
        // Prioriza título/subtítulo si existen y no forzamos logo
        if (title && !showLogo) {
            return (
                <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                    <Text
                        style={{
                            color: colors.text,
                            fontWeight: "800",
                            fontSize: 18,
                        }}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text
                            style={{
                                color: colors.textMuted,
                                fontSize: 12,
                            }}
                            numberOfLines={1}
                        >
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            );
        }

        // Logo (comportamiento original)
        return (
            <View style={{ flex: 1, alignItems: "center" }}>
                <Image
                    source={require("../../assets/logo-home.png")}
                    style={{ width: 280, height: 60, resizeMode: "contain" }}
                />
            </View>
        );
    };

    return (
        <View
            style={{
                paddingTop: insets.top + 6,
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.md,
                backgroundColor: colors.bg,
                flexDirection: "row",
                alignItems: "center",
            }}
        >
            {/* Izquierda */}
            {onPressLeft ? (
                <Pressable onPress={onPressLeft} hitSlop={10} style={{ width: 32, height: 32, justifyContent: "center" }}>
                    <Ionicons name={leftIcon} size={22} color={colors.text} />
                </Pressable>
            ) : (
                <View style={{ width: 32, height: 32 }} />
            )}

            {/* Centro */}
            {renderCenter()}

            {/* Derecha (compat con tu API) */}
            {onPressRight ? (
                <Pressable onPress={onPressRight} hitSlop={10} style={{ width: 32, height: 32, justifyContent: "center", alignItems: "flex-end" }}>
                    <Ionicons name={rightIcon} size={22} color={colors.text} />
                </Pressable>
            ) : (
                <View style={{ width: 32, height: 32 }} />
            )}
        </View>
    );
}
