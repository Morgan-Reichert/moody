import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const display = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
const body = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Moody — Suivi de l'humeur",
  description: "Ton humeur et tes traitements au quotidien, avec des rappels. Simple, doux, 100% privé.",
  manifest: "./manifest.json",
  applicationName: "Moody",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Moody" },
  icons: {
    icon: "./favicon.png",
    apple: "./apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#eaf3ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('./sw.js').catch(function(){});
              });
            }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
