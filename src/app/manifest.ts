import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClubLink",
    short_name: "ClubLink",
    description: "ClubLink — チーム運営アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#22201c",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
