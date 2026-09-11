import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CampusFleet | Smart Campus Transport & Fleet Management System",
  description:
    "Production-quality academic transport and fleet management system inspired by modern rapid transit operations, featuring railway seat reservations, live GPS tracking, and cryptographic digital QR pass validation.",
  manifest: "/manifest.webmanifest",
  applicationName: "CampusFleet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CampusFleet",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
