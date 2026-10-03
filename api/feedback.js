// Test-session outcomes for Part 6. Each event is one JSON line in the
// Vercel function logs: Project → Logs, filter on "mvp_feedback".
const OUTCOMES = new Set(["found", "not_found"]);

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body ?? {};
  if (!OUTCOMES.has(body.outcome)) {
    return res.status(400).json({ error: "Unknown outcome." });
  }

  const event = {
    event: "mvp_feedback",
    at: new Date().toISOString(),
    tester: text(body.tester, 40),
    outcome: body.outcome,
    query_index: Number.isInteger(body.queryIndex) ? body.queryIndex : null,
    query: text(body.query, 200),
    query_count: Number.isInteger(body.queryCount) ? body.queryCount : null,
    top_diagnostic: text(body.topDiagnostic, 120),
    description: text(body.description, 300),
    seconds_to_feedback: Number.isFinite(body.seconds) ? Math.round(body.seconds) : null,
  };
  console.log(JSON.stringify(event));
  return res.status(204).end();
}
