import { ImageResponse } from "next/og";

import { MODEL_RATINGS } from "@/lib/modelRatings";
import { getTeamTheme } from "@/lib/teamColors";

export const runtime = "edge";

export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("teams")?.split(",").slice(0, 10) ?? [];
  const selected = requested.map((abbr) => MODEL_RATINGS.find((team) => team.abbreviation === abbr)).filter(Boolean);
  const rows = selected.length === 10 ? selected : MODEL_RATINGS.slice(0, 10);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(135deg,#030712,#111827)", color: "white", padding: 54 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#f59e0b" }}>PRETZEL QUEST</div>
        <div style={{ display: "flex", fontSize: 22, color: "#9ca3af" }}>2026 · MY TOP 10</div>
      </div>
      <div style={{ display: "flex", fontSize: 48, fontWeight: 800, marginTop: 18 }}>My NFL Power Rankings</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
        {rows.map((team, index) => {
          const theme = getTeamTheme(team!.abbreviation);
          return (
            <div key={team!.abbreviation} style={{ width: index < 2 ? 528 : 258, display: "flex", alignItems: "center", background: "#0b1220", border: `2px solid ${theme.accent}`, borderRadius: 16, padding: "13px 17px" }}>
              <div style={{ width: 42, display: "flex", fontSize: 26, fontWeight: 800, color: "#9ca3af" }}>{index + 1}</div>
              <div style={{ width: 58, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, background: theme.primary, fontWeight: 800 }}>{team!.abbreviation}</div>
              <div style={{ display: "flex", marginLeft: 14, fontSize: index < 2 ? 22 : 18, fontWeight: 700 }}>{team!.abbreviation}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: "auto", color: "#6b7280", fontSize: 18 }}>Build yours at pretzel.quest</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
