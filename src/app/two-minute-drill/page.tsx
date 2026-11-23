import type { Metadata } from "next";
import TwoMinuteDrill from "./TwoMinuteDrill";

export const metadata: Metadata = {
  title: "Two-Minute Drill | Pretzel Quest",
  description: "Down four with 90 seconds left. Call the plays and drive for the winning touchdown.",
};

export default function Page() {
  return <TwoMinuteDrill />;
}
