import { parsePlan } from "./plan.js";
import { ENDPOINT, requestBody } from "./request.js";

export { MODEL } from "./request.js";

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

async function errorMessage(response, useServer) {
  let apiMessage = "";
  try {
    apiMessage = readApiMessage(await response.json());
  } catch {
    apiMessage = "";
  }

  // api/analyze.js already writes a message meant for the visitor.
  if (useServer && apiMessage) return apiMessage;
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

// True when api/analyze.js has a shared key, so visitors can skip the key
// field. Under plain `vite` dev there is no /api route and this is false.
export async function hasServerKey() {
  try {
    const response = await fetch("/api/analyze", { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.configured === true;
  } catch {
    return false;
  }
}

// Outcome logging for test sessions. Failures are ignored on purpose:
// a lost data point must never interrupt the person searching.
export function sendFeedback({ shownAt, ...event }) {
  fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...event, seconds: (Date.now() - shownAt) / 1000 }),
    keepalive: true,
  }).catch(() => {});
}

export async function analyzeMemory({ apiKey, description, signal, useServer }) {
  const timeoutSignal = AbortSignal.timeout(45_000);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response;
  try {
    response = useServer
      ? await fetch("/api/analyze", {
          method: "POST",
          signal: combined,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        })
      : await fetch(ENDPOINT, {
          method: "POST",
          signal: combined,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody(description)),
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
    throw new ApiError(
      useServer
        ? "Could not reach the server. Check your connection and try again."
        : "Could not reach api.x.ai. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response, useServer));
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
