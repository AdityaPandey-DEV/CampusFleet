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
        
        {/* Google Translate Integration */}
        <div id="google_translate_element" style={{ display: 'none' }}></div>
        <script src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async defer></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            function googleTranslateElementInit() {
              new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                autoDisplay: false
              }, 'google_translate_element');
            }
          `
        }} />
      </body>
    </html>
  );
}
