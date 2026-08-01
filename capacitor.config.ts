import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "tech.stariax.moody",
  appName: "Moody",
  webDir: "out",
  backgroundColor: "#eef2ec",
  ios: {
    contentInset: "always",
    backgroundColor: "#eef2ec",
  },
  android: {
    backgroundColor: "#eef2ec",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_moody",
      iconColor: "#1aad55",
    },
  },
};

export default config;
