const LIKELIHOOD_RANK = { high: 0, medium: 1, low: 2 };

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLikelihood(value) {
  const text = asText(value).toLowerCase();
  if (text === "high" || text === "medium" || text === "low") return text;
  return "medium";
}

export function extractJson(text) {
  if (typeof text !== "string") {
    throw new Error("not json");
  }
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("not json");
  }
  return JSON.parse(body.slice(start, end + 1));
}

export function normalizePlan(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The assistant returned an unexpected format. Try again.");
  }

  const search_strategies = asArray(data.search_strategies)
    .map((item) => ({
      query: asText(item?.query),
      explanation: asText(item?.explanation),
    }))
    .filter((item) => item.query && item.explanation);

  const diagnostics = asArray(data.diagnostics)
    .map((item) => ({
      issue: asText(item?.issue),
      explanation: asText(item?.explanation),
      likelihood: normalizeLikelihood(item?.likelihood),
    }))
    .filter((item) => item.issue && item.explanation)
    .sort((a, b) => LIKELIHOOD_RANK[a.likelihood] - LIKELIHOOD_RANK[b.likelihood]);

  const pro_tips = asArray(data.pro_tips)
    .map((item) => ({
      tip: asText(item?.tip),
      detail: asText(item?.detail),
    }))
    .filter((item) => item.tip && item.detail);

  if (search_strategies.length === 0) {
    throw new Error("The assistant did not return any search queries. Try again.");
  }

  return { search_strategies, diagnostics, pro_tips };
}

export function parsePlan(text) {
  let data;
  try {
    data = extractJson(text);
  } catch {
    throw new Error("The assistant returned something that was not usable JSON. Try again.");
  }
  return normalizePlan(data);
}
