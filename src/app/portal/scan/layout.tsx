import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan QR - CampusFleet",
  description: "Scan a Bus or Seat QR code to board your campus bus instantly.",
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
