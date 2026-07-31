import type { CSSProperties } from "react";

type TeamTheme = {
  primary: string;
  accent: string;
  foreground?: string;
};

const TEAM_THEMES: Record<string, TeamTheme> = {
  ARI: { primary: "#97233F", accent: "#FFB612" },
  ATL: { primary: "#A71930", accent: "#000000" },
  BAL: { primary: "#241773", accent: "#9E7C0C" },
  BUF: { primary: "#00338D", accent: "#C60C30" },
  CAR: { primary: "#0085CA", accent: "#101820" },
  CHI: { primary: "#0B162A", accent: "#C83803" },
  CIN: { primary: "#FB4F14", accent: "#000000" },
  CLE: { primary: "#311D00", accent: "#FF3C00" },
  DAL: { primary: "#003594", accent: "#869397" },
  DEN: { primary: "#FB4F14", accent: "#002244" },
  DET: { primary: "#0076B6", accent: "#B0B7BC" },
  GB: { primary: "#203731", accent: "#FFB612" },
  HOU: { primary: "#03202F", accent: "#A71930" },
  IND: { primary: "#002C5F", accent: "#A2AAAD" },
  JAX: { primary: "#006778", accent: "#D7A22A" },
  KC: { primary: "#E31837", accent: "#FFB81C" },
  LAC: { primary: "#0080C6", accent: "#FFC20E" },
  LAR: { primary: "#003594", accent: "#FFA300" },
  LV: { primary: "#000000", accent: "#A5ACAF" },
  MIA: { primary: "#008E97", accent: "#FC4C02" },
  MIN: { primary: "#4F2683", accent: "#FFC62F" },
  NE: { primary: "#002244", accent: "#C60C30" },
  NO: { primary: "#A08A58", accent: "#D3BC8D" },
  NYG: { primary: "#0B2265", accent: "#A71930" },
  NYJ: { primary: "#125740", accent: "#FFFFFF" },
  PHI: { primary: "#004C54", accent: "#A5ACAF" },
  PIT: { primary: "#101820", accent: "#FFB612" },
  SEA: { primary: "#002244", accent: "#69BE28" },
  SF: { primary: "#AA0000", accent: "#B3995D" },
  TB: { primary: "#D50A0A", accent: "#FF7900" },
  TEN: { primary: "#0C2340", accent: "#4B92DB" },
  WAS: { primary: "#5A1414", accent: "#FFB612" },
};

export function getTeamTheme(abbreviation: string) {
  return TEAM_THEMES[abbreviation] ?? { primary: "#1D4ED8", accent: "#93C5FD" };
}

export function selectedTeamStyle(abbreviation: string): CSSProperties {
  const theme = getTeamTheme(abbreviation);
  return {
    backgroundColor: theme.primary,
    borderColor: theme.accent,
    color: theme.foreground ?? "#FFFFFF",
    boxShadow: `0 0 0 1px ${theme.accent}, 0 10px 28px ${theme.primary}55`,
  };
}
