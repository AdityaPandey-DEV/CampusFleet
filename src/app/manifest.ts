import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CampusFleet | Smart University Transit",
    short_name: "CampusFleet",
    description: "Safe, guaranteed & stress-free campus commute. redBus-style seat reservations, 15s live bus GPS radar, and cryptographic digital QR passes.",
    start_url: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Live Bus Radar",
        url: "/portal/tracker",
        description: "Track fleet GPS coordinates and stop arrival ETA",
      },
      {
        name: "Digital QR Pass",
        url: "/portal/pass",
        description: "View encrypted rotating student QR pass",
      },
      {
        name: "Reserve Seat",
        url: "/portal/booking",
        description: "Book a guaranteed seat on your commute shift",
      },
    ],
  };
}
