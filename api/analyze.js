import { ENDPOINT, MAX_DESCRIPTION, requestBody } from "../src/request.js";

// GET tells the page whether a shared key is configured, so testers
// never see the key field. POST forwards one description to xAI.
export default async function handler(req, res) {
  const apiKey = process.env.XAI_API_KEY;

  if (req.method === "GET") {
    return res.status(200).json({ configured: Boolean(apiKey) });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!apiKey) {
    return res.status(503).json({ error: "No server key is configured. Paste your own xAI key instead." });
  }

  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  if (!description) {
    return res.status(400).json({ error: "Describe the photo you're looking for." });
  }
  if (description.length > MAX_DESCRIPTION) {
    return res.status(400).json({ error: `Keep the description under ${MAX_DESCRIPTION} characters.` });
  }

  let upstream;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(40_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody(description)),
    });
  } catch {
    return res.status(504).json({ error: "The xAI API did not answer in time. Try again." });
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    console.error("xai_error", upstream.status, JSON.stringify(payload)?.slice(0, 500));
    // The key is ours, so a 401 here is a config problem, not the visitor's.
    const status = upstream.status === 429 ? 429 : 502;
    return res.status(status).json({
      error: status === 429
        ? "The shared key hit its rate limit. Wait a moment, then try again."
        : "The xAI API had a problem. Try again in a moment.",
    });
  }

  return res.status(200).json(payload);
}
