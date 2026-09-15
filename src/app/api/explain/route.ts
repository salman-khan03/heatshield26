import { GoogleGenAI } from "@google/genai";

// Turns the zone facts already shown in the planner into a short planning rationale.
// Gemini only restates and connects the numbers it is given; when GEMINI_API_KEY is not
// configured (or the call fails) the route returns a deterministic template instead.

interface ExplainBody {
  zone: {
    label: string;
    neighborhood: string;
    riskIndex: number;
    tier: string;
    components: Record<string, { score: number; weight: number }>;
    facts: Record<string, string | number | null>;
  };
  recommendation: { type: string; label: string; costAssumptionUSD: number; modeledEffect: string; description: string };
  scenario: { attendance: number; airTempF: number; humidity: number; window: string; modeSplitPct: Record<string, number> };
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM = `You write short decision rationales for City of Houston event, public-health and emergency planners using the HeatShield 26 heat-risk planner.

Write 3–4 plain sentences (no headings, no bullet points, no markdown). Explain why this zone ranks where it does by naming its two or three largest weighted drivers with their numbers, why the recommended intervention addresses those drivers, and one way the investment stays useful after this event (future stadium events, festivals, heat emergencies). Use only the facts provided; do not invent data, places or outcomes. The risk index is a decision-support composite, not a medical prediction, and costs and effect sizes are planning assumptions — say so briefly if you cite them.`;

function template(b: ExplainBody): string {
  const drivers = Object.entries(b.zone.components)
    .map(([k, v]) => ({ k, contrib: (v.score * v.weight) / 100, score: v.score }))
    .sort((x, y) => y.contrib - x.contrib)
    .slice(0, 3);
  const list = drivers.map((d) => `${d.k.toLowerCase()} (${d.score}/100)`).join(", ");
  const f = b.zone.facts;
  return `${b.zone.neighborhood} scores ${b.zone.riskIndex}/100 (${b.zone.tier}) mainly because of ${list}. Under a ${b.scenario.airTempF}°F, ${b.scenario.humidity}% humidity ${b.scenario.window.toLowerCase()} scenario the local heat index reaches about ${f.scenarioHeatIndexF}°F, tree canopy is ${f.treeCanopyPct_NLCD}% and the nearest City cool center is ${f.distanceToCoolingMi} mi away. A ${b.recommendation.label.toLowerCase()} targets these drivers directly (${b.recommendation.modeledEffect.replace(/\.$/, "")}; cost assumption $${b.recommendation.costAssumptionUSD.toLocaleString("en-US")}). The same asset can be redeployed for future NRG Park events, festivals and city heat emergencies.`;
}

export async function POST(request: Request) {
  let body: ExplainBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.zone || !body?.recommendation) return Response.json({ error: "Missing zone or recommendation" }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ text: template(body), source: "template" });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Planner facts (JSON):\n${JSON.stringify(body, null, 2)}`,
      config: { systemInstruction: SYSTEM, maxOutputTokens: 2048 },
    });
    const text = response.text?.trim();
    return Response.json({ text: text || template(body), source: text ? "gemini" : "template" });
  } catch (error) {
    console.warn(`explain: Gemini unavailable (${error instanceof Error ? error.message.slice(0, 160) : "unknown error"}) — serving template`);
    return Response.json({ text: template(body), source: "template" });
  }
}
