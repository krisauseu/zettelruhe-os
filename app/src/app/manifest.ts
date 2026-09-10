import type { MetadataRoute } from "next";

/** PWA-light: Name + Icons, kein Service Worker / Offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zettelruhe",
    short_name: "Zettelruhe",
    description:
      "Self-hosted Buchhaltung für Solo-Selbstständige in Deutschland",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f8",
    theme_color: "#4b5fd1",
    lang: "de",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
