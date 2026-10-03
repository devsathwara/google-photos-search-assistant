import { parsePlan } from "./plan.js";
import { SYSTEM_PROMPT } from "./prompt.js";

// grok-4.3 is $1.25 / $2.50 per 1M tokens. grok-4.7 is $2 / $6, and it
// reasons by default, which is billed as output. reasoning_effort "none"
// skips that. https://docs.x.ai/developers/models/grok-4.3
export const MODEL = "grok-4.3";

const ENDPOINT = "https://api.x.ai/v1/chat/completions";

export class ApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiError";
  }
}

function messageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      return "";
    })
    .join("");
}

function readApiMessage(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.error === "string") return body.error;
  if (typeof body.error?.message === "string") return body.error.message;
  if (typeof body.message === "string") return body.message;
  return "";
}

async function errorMessage(response) {
  let apiMessage = "";
  try {
    apiMessage = readApiMessage(await response.json());
  } catch {
    apiMessage = "";
  }

  if (response.status === 401 || response.status === 403) {
    return "That API key was rejected. Paste a valid key from console.x.ai and try again.";
  }
  if (response.status === 429) {
    return "The API rate limit or quota was reached. Wait a moment, then try again.";
  }
  if (response.status >= 500) {
    return "The xAI API had a problem on its side. Try again in a moment.";
  }
  if (apiMessage) return apiMessage;
  return `The request failed (${response.status}). Try again.`;
}

export async function analyzeMemory({ apiKey, description, signal }) {
  const timeoutSignal = AbortSignal.timeout(45_000);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal: combined,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        reasoning_effort: "none",
        // Live Search (search_parameters) was removed in January 2026.
        // Including it makes api.x.ai return HTTP 410.
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: description },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    if (signal?.aborted) {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      throw abortError;
    }
    if (err?.name === "TimeoutError" || timeoutSignal.aborted) {
      throw new ApiError("The request took too long. Try again.");
    }
    throw new ApiError("Could not reach api.x.ai. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response));
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The API returned a response that was not JSON. Try again.");
  }

  const text = messageText(payload?.choices?.[0]?.message);
  if (!text) {
    throw new ApiError("The API returned an empty response. Try again.");
  }

  try {
    return parsePlan(text);
  } catch (err) {
    throw new ApiError(err.message || "The assistant returned an unexpected format. Try again.");
  }
}
