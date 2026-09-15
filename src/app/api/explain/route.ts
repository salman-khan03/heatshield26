import Anthropic from "@anthropic-ai/sdk";

// Turns the zone facts already shown in the planner into a short planning rationale.
// Claude only restates and connects the numbers it is given; when no credentials are
// configured the route returns a deterministic template instead.

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

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `Planner facts (JSON):\n${JSON.stringify(body, null, 2)}` }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ text: template(body), source: "template" });
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return Response.json({ text: text || template(body), source: text ? "claude" : "template" });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("explain: authentication failed — check ANTHROPIC_API_KEY");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("explain: rate limited");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`explain: API error ${error.status}: ${error.message}`);
    } else {
      console.warn(`explain: Claude unavailable (${error instanceof Error ? error.message.split(".")[0] : "unknown error"}) — serving template`);
    }
    return Response.json({ text: template(body), source: "template" });
  }
}
