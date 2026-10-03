import { SYSTEM_PROMPT } from "./prompt.js";

// grok-4.3 is $1.25 / $2.50 per 1M tokens. grok-4.7 is $2 / $6, and it
// reasons by default, which is billed as output. reasoning_effort "none"
// skips that. https://docs.x.ai/developers/models/grok-4.3
export const MODEL = "grok-4.3";

export const ENDPOINT = "https://api.x.ai/v1/chat/completions";

export const MAX_DESCRIPTION = 4000;

// Shared by the browser (own key) and api/analyze.js (server key).
export function requestBody(description) {
  return {
    model: MODEL,
    temperature: 0.2,
    reasoning_effort: "none",
    // Caps spend per call so a shared server key lasts through testing.
    max_tokens: 1500,
    // Live Search (search_parameters) was removed in January 2026.
    // Including it makes api.x.ai return HTTP 410.
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: description },
    ],
    response_format: { type: "json_object" },
  };
}
