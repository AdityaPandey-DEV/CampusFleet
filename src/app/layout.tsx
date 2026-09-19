import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { CampusTimeProvider } from "@/components/common/CampusTimeProvider";
import { LanguageProvider } from "@/components/common/LanguageProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CampusFleet | Smart Campus Transport & Fleet Management System",
  description:
    "Enterprise campus fleet management system featuring reserved seat bookings, automated standby queue management, live GPS telematics, and cryptographic digital QR pass validation.",
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
          <LanguageProvider>
            <CampusTimeProvider>
              {children}
            </CampusTimeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
