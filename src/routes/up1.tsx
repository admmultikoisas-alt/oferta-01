import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/up1")({
  head: () => ({
    meta: [
      { title: "Spotify Rewards - Oferta Especial" },
      {
        name: "description",
        content: "Oferta especial para membros Spotify Rewards.",
      },
      { property: "og:title", content: "Spotify Rewards - Oferta Especial" },
      {
        property: "og:description",
        content: "Oferta especial para membros Spotify Rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpsellPage,
});

function UpsellPage() {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(window.location.search);
  }, []);

  return (
    <iframe
      src={`/sp/up1/index.html${search}`}
      title="Oferta Especial"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
