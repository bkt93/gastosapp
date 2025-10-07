// theme.ts
import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

// 👇 extendemos con tokens de UI que usa el login (card, border, etc.)
export const Colors = {
  light: {
    text: "#11181C",
    textDim: "#6B7280",      // nuevo
    background: "#FFFFFF",
    card: "#F4F4F5",         // nuevo
    inputBg: "#FFFFFF",      // nuevo
    border: "#E5E7EB",       // nuevo
    primary: "#4CAF50",      // nuevo (tu verde marca)
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    textDim: "#A1A1A1",      // nuevo
    background: "#151718",
    card: "#1C1C1E",         // nuevo
    inputBg: "#202022",      // nuevo
    border: "#2A2A2A",       // nuevo
    primary: "#4CAF50",      // nuevo (mismo verde, queda bien en dark)
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
