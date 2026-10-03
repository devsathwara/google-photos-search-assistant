// Test-session outcomes for Part 6. Each event becomes a row in a Google
// Sheet when SHEET_WEBHOOK_URL is set (see docs/feedback-sheet.gs), and is
// also printed to the Vercel logs as a fallback.
const OUTCOMES = new Set(["found", "not_found"]);

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default async function handler(req, res) {
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
    miss_reason: text(body.missReason, 40),
    tried_before: text(body.triedBefore, 40),
    setting_change: text(body.settingChange, 40),
    took_backup_action: body.settingChange ? body.settingChange !== "none" : null,
    helpful: Number.isInteger(body.helpful) && body.helpful >= 1 && body.helpful <= 5 ? body.helpful : null,
    want_native: text(body.wantNative, 10),
    comment: text(body.comment, 500),
    description: text(body.description, 300),
    seconds_to_feedback: Number.isFinite(body.seconds) ? Math.round(body.seconds) : null,
  };
  console.log(JSON.stringify(event));

  // Awaited because Vercel can stop the function once the response is sent.
  const sheetUrl = process.env.SHEET_WEBHOOK_URL;
  if (sheetUrl) {
    try {
      const response = await fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) console.error("sheet_error", response.status);
    } catch (err) {
      console.error("sheet_error", err?.name || "unknown");
    }
  }
  return res.status(204).end();
}
