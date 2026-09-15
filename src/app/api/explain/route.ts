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
  scenario: { venueName: string; attendance: number; airTempF: number; humidity: number; window: string; modeSplitPct: Record<string, number> };
}

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const SYSTEM = `You write short decision rationales for City of Houston event, public-health and emergency planners using the HeatShield 26 heat-risk planner.

Write 3–4 plain sentences (no headings, no bullet points, no markdown). Explain why this zone ranks where it does by naming its two or three largest weighted drivers with their numbers, why the recommended intervention addresses those drivers, and one way the investment stays useful after this event (future stadium events, festivals, heat emergencies). Use only the facts provided; do not invent data, places or outcomes. The risk index is a decision-support composite, not a medical prediction, and costs and effect sizes are planning assumptions — say so briefly if you cite them.`;

function template(b: ExplainBody): string {
  const drivers = Object.entries(b.zone.components)
    .map(([k, v]) => ({ k, contrib: (v.score * v.weight) / 100, score: v.score }))
    .sort((x, y) => y.contrib - x.contrib)
    .slice(0, 3);
  const list = drivers.map((d) => `${d.k.toLowerCase()} (${d.score}/100)`).join(", ");
  const f = b.zone.facts;
  return `${b.zone.neighborhood} scores ${b.zone.riskIndex}/100 (${b.zone.tier}) mainly because of ${list}. Under a ${b.scenario.airTempF}°F, ${b.scenario.humidity}% humidity ${b.scenario.window.toLowerCase()} scenario at ${b.scenario.venueName}, the local heat index reaches about ${f.scenarioHeatIndexF}°F, tree canopy is ${f.treeCanopyPct_NLCD}% and the nearest City cool center is ${f.distanceToCoolingMi} mi away. A ${b.recommendation.label.toLowerCase()} targets these drivers directly (${b.recommendation.modeledEffect.replace(/\.$/, "")}; cost assumption $${b.recommendation.costAssumptionUSD.toLocaleString("en-US")}). The same asset can be redeployed for future events at this venue, festivals and city heat emergencies.`;
}

export async function POST(request: Request) {
  let body: ExplainBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.zone || !body?.recommendation) return Response.json({ error: "Missing zone or recommendation" }, { status: 400 });

  // Pre-rank the weighted drivers so the model restates the math instead of doing it.
  const rankedDrivers = Object.entries(body.zone.components)
    .map(([component, v]) => ({ component, score: v.score, weightPct: v.weight, pointsOfRisk: Number(((v.score * v.weight) / 100).toFixed(1)) }))
    .sort((a, b) => b.pointsOfRisk - a.pointsOfRisk);
  const prompt = `Planner facts (JSON). "rankedDrivers" is already sorted from largest to smallest contribution to the risk index; use that order.\n${JSON.stringify({ ...body, rankedDrivers }, null, 2)}`;
  const gemini = await explainWithGemini(prompt);
  if (gemini) return Response.json({ text: gemini.text, source: "gemini", model: gemini.model });
  const groq = await explainWithGroq(prompt);
  if (groq) return Response.json({ text: groq.text, source: "groq", model: groq.model });
  return Response.json({ text: template(body), source: "template" });
}

const GEMINI_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-lite-latest"];
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

async function explainWithGemini(prompt: string): Promise<{ text: string; model: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  // Configured model first; on overload/rate-limit errors fall back to other Flash models.
  for (const model of [...new Set([MODEL, ...GEMINI_FALLBACKS])]) {
    try {
      const response = await ai.models.generateContent({ model, contents: prompt, config: { systemInstruction: SYSTEM, maxOutputTokens: 2048 } });
      const text = response.text?.trim();
      if (text) return { text, model };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`explain: ${model} failed (${message.slice(0, 120)})`);
      if (!/\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(message)) return null;
    }
  }
  return null;
}

/** Groq's OpenAI-compatible chat completions endpoint, used when Gemini is unavailable. */
async function explainWithGroq(prompt: string): Promise<{ text: string; model: string } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        reasoning_effort: "low",
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const text: string | undefined = json.choices?.[0]?.message?.content?.trim();
    return text ? { text, model: GROQ_MODEL } : null;
  } catch (error) {
    console.warn(`explain: Groq ${GROQ_MODEL} failed (${error instanceof Error ? error.message.slice(0, 120) : "unknown error"})`);
    return null;
  }
}
