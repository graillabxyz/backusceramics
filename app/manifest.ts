import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Backus Ceramics",
    short_name: "Backus",
    description: "Backus Ceramics studio, shop, and point of sale.",
    start_url: "/admin/pos",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#ede3d4",
    theme_color: "#ede3d4",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/Logo.jpeg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  }
}
