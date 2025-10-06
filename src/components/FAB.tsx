import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { colors, spacing } from "../theme";

type Props = {
    onPress: () => void;
    style?: ViewStyle;
    iconName?: keyof typeof Ionicons.glyphMap;
    accessibilityLabel?: string;
    label?: string; // 👈 nuevo
};

export default function FAB({
    onPress,
    style,
    iconName = "add",
    accessibilityLabel = "Añadir",
    label,
}: Props) {
    return (
        <View
            pointerEvents="box-none"
            style={[
                {
                    position: "absolute",
                    right: spacing.lg,
                    bottom: spacing.lg,
                    alignItems: "center",
                },
                style,
            ]}
        >
            <Pressable
                onPress={onPress}
                accessibilityLabel={accessibilityLabel}
                style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    width: 60,
                    height: 60,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    elevation: 8,
                })}
            >
                <Ionicons name={iconName} size={30} color="white" />
            </Pressable>

            {label ? (
                <Text
                    style={{
                        marginTop: 6,
                        color: "white",
                        fontWeight: "700",
                        fontSize: 12,
                        opacity: 0.9,
                    }}
                >
                    {label}
                </Text>
            ) : null}
        </View>
    );
}
