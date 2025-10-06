// src/components/GreetingBar.tsx
import { Text, View } from "react-native";
import { colors, spacing } from "../theme";

type Props = { name?: string | null };

export default function GreetingBar({ name }: Props) {
  // Normalizo el nombre (fallback a vacío)
  const who = (name ?? "").trim();
  // Si está vacío, evitamos la coma doble y solo mostramos "Hola!"
  const title = who ? `Hola, ${who}!` : "Hola!";

  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        marginTop: 16,
      }}
    >
      <Text
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title} 👋
      </Text>

      <Text style={{ color: colors.textMuted, marginTop: 4 }}>
        ¿Listo para organizar tus gastos?
      </Text>
    </View>
  );
}
