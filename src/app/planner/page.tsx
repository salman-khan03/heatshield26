import type { Metadata } from "next";
import Planner from "@/components/planner/Planner";

export const metadata: Metadata = {
  title: "Planner — HeatShield 26",
};

export default function PlannerPage() {
  return <Planner />;
}
