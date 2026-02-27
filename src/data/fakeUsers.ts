export type FakeUser = {
  id: string;
  name: string;
  picks: Record<string, string>; // gameId -> teamAbbr
};

export const fakeUsers: FakeUser[] = [
  {
    id: "u_scott",
    name: "Scott",
    picks: {}, // we'll load your real picks from LocalStorage in the page
  },
  {
    id: "u_1",
    name: "Alex",
    picks: {
      "2026_w1_g1": "KC",
      "2026_w1_g2": "DEN",
      "2026_w1_g3": "SEA",
      "2026_w2_g1": "MIA",
      "2026_w2_g2": "LAC",
      "2026_w2_g3": "PHI",
    },
  },
  {
    id: "u_2",
    name: "Jordan",
    picks: {
      "2026_w1_g1": "BUF",
      "2026_w1_g2": "LAC",
      "2026_w1_g3": "SF",
      "2026_w2_g1": "NYJ",
      "2026_w2_g2": "DEN",
      "2026_w2_g3": "DAL",
    },
  },
  {
    id: "u_3",
    name: "Taylor",
    picks: {
      "2026_w1_g1": "KC",
      "2026_w1_g2": "LAC",
      "2026_w1_g3": "SF",
      "2026_w2_g1": "MIA",
      "2026_w2_g2": "LAC",
      "2026_w2_g3": "DAL",
    },
  },
];