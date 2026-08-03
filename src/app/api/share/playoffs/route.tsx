import { ImageResponse } from "next/og";

import { getTeamTheme } from "@/lib/teamColors";

export const runtime = "edge";

function Conference({ label, teams }: { label: string; teams: string[] }) {
  return (
    <div style={{ width: 520, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 800, marginBottom: 14 }}>{label}</div>
      {teams.map((abbr, index) => {
        const theme = getTeamTheme(abbr);
        return (
          <div key={`${label}-${abbr}`} style={{ display: "flex", alignItems: "center", background: "#0b1220", border: `2px solid ${theme.accent}`, borderRadius: 13, padding: "10px 14px", marginBottom: 9 }}>
            <div style={{ width: 38, display: "flex", fontSize: 22, color: "#9ca3af", fontWeight: 800 }}>{index + 1}</div>
            <div style={{ width: 66, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: theme.primary, fontWeight: 800 }}>{abbr}</div>
            <div style={{ display: "flex", marginLeft: 16, fontSize: 18, color: index < 4 ? "#fbbf24" : "#d1d5db" }}>{index < 4 ? "Division leader" : "Wild card"}</div>
          </div>
        );
      })}
    </div>
  );
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const afc = (params.get("afc") ?? "").split(",").slice(0, 7);
  const nfc = (params.get("nfc") ?? "").split(",").slice(0, 7);
  const mode = params.get("mode") === "user" ? "MY PICKS" : "MODEL";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#030712,#111827)", color: "white", padding: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>PRETZEL QUEST</div>
        <div style={{ display: "flex", fontSize: 21, color: "#9ca3af" }}>2026 · {mode}</div>
      </div>
      <div style={{ display: "flex", fontSize: 44, fontWeight: 800, marginTop: 12, marginBottom: 22 }}>Projected Playoff Field</div>
      <div style={{ display: "flex", gap: 40 }}><Conference label="AFC" teams={afc} /><Conference label="NFC" teams={nfc} /></div>
    </div>,
    { width: 1200, height: 800 },
  );
}
