import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Uni-Organizer Tom",
    short_name: "Uni",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0ea5e9",
    lang: "de",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
