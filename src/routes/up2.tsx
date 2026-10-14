import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/up2")({
  head: () => ({
    meta: [
      { title: "Spotify Rewards - Access Confirmed" },
      {
        name: "description",
        content:
          "Your Spotify Rewards access is confirmed. Open your dashboard to withdraw your balance.",
      },
      { property: "og:title", content: "Spotify Rewards - Access Confirmed" },
      {
        property: "og:description",
        content:
          "Your Spotify Rewards access is confirmed. Open your dashboard to withdraw your balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(window.location.search);
  }, []);

  return (
    <iframe
      src={`/sp/up2/index.html${search}`}
      title="Spotify Rewards - Access Confirmed"
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
