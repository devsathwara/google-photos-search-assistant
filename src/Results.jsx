import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sendFeedback } from "./api.js";
import { FeedbackSheet } from "./FeedbackSheet.jsx";
import { FolderCheck } from "./FolderCheck.jsx";

const LIKELIHOOD = {
  high: { label: "Most likely", className: "bg-warn-soft text-warn" },
  medium: { label: "Possible", className: "bg-paper text-ink-2" },
  low: { label: "Less likely", className: "bg-paper text-ink-3" },
};

const LOADING_STEPS = [
  "Reading your description…",
  "Turning it into short searches…",
  "Checking why it might be hidden…",
];

function photosUrl(query) {
  return `https://photos.google.com/search/${encodeURIComponent(query)}`;
}

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" strokeLinecap="round" />
    </svg>
  );
}

function ArrowOut() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 4h8v8M16 4l-9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="chevron h-4 w-4 shrink-0 text-ink-3 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoadingState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" className="rise">
      <p className="flex items-center gap-2.5 text-[15px] font-medium text-ink-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden="true" />
        {LOADING_STEPS[step]}
      </p>
      <div className="mt-6 space-y-3" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="rounded-2xl border border-line bg-card p-4">
            <div className="skeleton h-11 rounded-xl" />
            <div className="skeleton mt-3 h-3.5 w-3/4 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Status line on a search card after it was opened or copied. The full
// questions live in the sheet; this is the way back to it.
function QueryStatus({ verdict, onAsk, locked }) {
  if (verdict === "found") {
    return <p className="mt-3 rounded-xl bg-good-soft px-3.5 py-2.5 text-sm font-medium text-good">✓ This search found it</p>;
  }
  if (verdict === "miss") {
    return <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-sm text-ink-3">Didn't find it with this one</p>;
  }
  if (locked) return null;
  return (
    <button
      type="button"
      onClick={onAsk}
      className="rise mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-accent-soft px-3.5 text-left text-sm font-medium text-ink hover:bg-[#e2e9f9]"
    >
      Did it find your photo?
      <span className="text-accent">Answer →</span>
    </button>
  );
}

export function Results({ description, plan, shownAt, tester }) {
  const [tried, setTried] = useState(() => new Set());
  const [verdicts, setVerdicts] = useState({});
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");
  const [sheet, setSheet] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const timer = useRef(0);
  // Which search the tester left to try, and whether the page was hidden or
  // blurred since. Coming back with both set opens the sheet for that search.
  const pending = useRef(null);
  const wasAway = useRef(false);
  const latest = useRef({ verdicts, submitted, sheet });
  useEffect(() => {
    latest.current = { verdicts, submitted, sheet };
  }, [verdicts, submitted, sheet]);

  function flash(id) {
    setCopiedId(id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiedId(""), 1600);
  }

  async function copy(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError("");
      flash(id);
    } catch {
      setCopyError("Your browser blocked copying. Press and hold the search text to copy it instead.");
    }
  }

  function markTried(index) {
    setTried((current) => (current.has(index) ? current : new Set(current).add(index)));
    pending.current = index;
    wasAway.current = false;
  }

  useEffect(() => {
    function away() {
      if (pending.current != null) wasAway.current = true;
    }
    function back() {
      if (document.visibilityState !== "visible" || !wasAway.current) return;
      const index = pending.current;
      pending.current = null;
      wasAway.current = false;
      const { verdicts: v, submitted: done, sheet: open } = latest.current;
      if (index == null || done || open || v[index]) return;
      setSheet({ type: "query", index });
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") away();
      else back();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", away);
      window.removeEventListener("focus", back);
    };
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  function answerQuery(index, verdict) {
    if (verdicts[index] === verdict) return;
    setVerdicts((current) => ({ ...current, [index]: verdict }));
    sendFeedback({
      kind: "query",
      tester,
      outcome: verdict === "found" ? "found" : "not_found",
      queryIndex: index + 1,
      query: plan.search_strategies[index].query,
      queryCount: plan.search_strategies.length,
      topDiagnostic: plan.diagnostics[0]?.issue ?? "",
      description,
      shownAt,
    });
  }

  const foundEntry = Object.entries(verdicts).find(([, value]) => value === "found");
  const foundIndex = foundEntry ? Number(foundEntry[0]) : null;

  function submitSummary(answers) {
    const via = answers.foundVia;
    const queries = plan.search_strategies;
    const queryResults = Object.entries(verdicts)
      .map(([index, value]) => `${Number(index) + 1}:${value}`)
      .join(",");
    sendFeedback({
      kind: "summary",
      tester,
      outcome: answers.found ? "found" : "not_found",
      queryIndex: typeof via === "number" ? via + 1 : undefined,
      query: typeof via === "number" ? queries[via].query : via === "other" ? "(something else)" : "",
      missReason: answers.missReason ?? "",
      triedBefore: answers.triedBefore ?? "",
      settingChange: answers.settingChange ?? "",
      helpful: answers.helpful ?? undefined,
      wantNative: answers.wantNative ?? "",
      comment: answers.comment.trim(),
      queryCount: queries.length,
      queriesTried: tried.size,
      queryResults,
      topDiagnostic: plan.diagnostics[0]?.issue ?? "",
      description,
      shownAt,
    });
    setSubmitted(true);
  }

  return (
    <div className="rise">
      <section aria-labelledby="strategies-heading">
        <p className="line-clamp-2 text-sm leading-6 text-ink-3">For “{description}”</p>
        <h2 id="strategies-heading" className="mt-1 text-[24px] leading-tight font-semibold tracking-[-0.02em]">
          Try these searches
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-ink-2">
          Start with the first. Each one opens in Google Photos. On your phone, you can copy it and paste it
          into the app's search bar instead.
        </p>

        {copyError ? (
          <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
            {copyError}
          </p>
        ) : null}

        <ol className="mt-5 space-y-3">
          {plan.search_strategies.map((item, index) => {
            const id = `query-${index}`;
            const found = verdicts[index] === "found";
            return (
              <li
                key={id}
                className={`rounded-2xl border bg-card p-3.5 sm:p-4 ${found ? "border-good" : "border-line"}`}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
                  <span>Search {index + 1}</span>
                  {index === 0 ? (
                    <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">Best bet</span>
                  ) : null}
                </div>

                <div className="mt-2 flex items-stretch gap-2">
                  <a
                    href={photosUrl(item.query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markTried(index)}
                    aria-label={`Search Google Photos for ${item.query} (opens in a new tab)`}
                    className="group flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line-strong bg-paper/50 px-3.5 py-2 hover:border-ink hover:bg-card"
                  >
                    <SearchIcon className="h-[18px] w-[18px] text-ink-3 group-hover:text-ink" />
                    <span className="min-w-0 flex-1 text-[17px] leading-6 font-semibold break-words">{item.query}</span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
                      <span className="hidden sm:inline">Open</span>
                      <ArrowOut />
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      markTried(index);
                      copy(id, item.query);
                    }}
                    aria-label={`Copy ${item.query}`}
                    className="min-h-12 w-[68px] shrink-0 rounded-xl border border-line text-sm font-medium text-ink-2 hover:border-line-strong hover:text-ink"
                  >
                    {copiedId === id ? "Copied" : "Copy"}
                  </button>
                </div>

                <p className="mt-2.5 text-sm leading-6 text-ink-3">{item.explanation}</p>

                {tried.has(index) || verdicts[index] ? (
                  <QueryStatus
                    verdict={verdicts[index] ?? null}
                    locked={submitted}
                    onAsk={() => setSheet({ type: "query", index })}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="missing-heading" className="mt-12">
        <h2 id="missing-heading" className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
          Still can't find it?
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-ink-2">
          Search only sees photos that were backed up. These are the most likely reasons this one isn't showing.
        </p>

        {plan.diagnostics.length > 0 ? (
          <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {plan.diagnostics.map((item, index) => {
              const level = LIKELIHOOD[item.likelihood] ?? LIKELIHOOD.medium;
              return (
                <details key={`${item.issue}-${index}`} open={index === 0} className="group">
                  <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 hover:bg-paper/50">
                    <span className="min-w-0 flex-1">
                      <span className={`mr-2 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${level.className}`}>
                        {level.label}
                      </span>
                      <span className="text-[15px] leading-6 font-semibold">{item.issue}</span>
                    </span>
                    <Chevron />
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-6 whitespace-pre-wrap text-ink-2">{item.explanation}</p>
                </details>
              );
            })}
          </div>
        ) : null}

        {plan.pro_tips.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-base font-semibold">What to do</h3>
            <ol className="mt-3 space-y-4">
              {plan.pro_tips.map((item, index) => (
                <li key={`${item.tip}-${index}`} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] leading-6 font-semibold">{item.tip}</p>
                    <p className="mt-0.5 text-sm leading-6 whitespace-pre-wrap text-ink-2">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <FolderCheck />
      </section>

      {submitted ? (
        <p className="mt-12 rounded-2xl border border-line bg-card px-4 py-3.5 text-center text-sm text-ink-2">
          Thanks for the feedback. Looking for another photo? Describe it at the top.
        </p>
      ) : (
        <>
          <div className="h-20" aria-hidden="true" />
          {createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setSheet({ type: "general" })}
              className="pointer-events-auto mx-auto flex min-h-12 w-full max-w-md items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-left text-white shadow-[0_8px_24px_rgba(28,27,25,0.28)] hover:bg-[#33312d]"
            >
              <span className="text-[15px] font-medium">Done searching? Tell us how it went</span>
              <span className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink">30 sec</span>
            </button>
          </div>,
          document.body,
          )}
        </>
      )}

      {sheet ? createPortal(
        <FeedbackSheet
          key={sheet.type === "query" ? `q${sheet.index}` : "general"}
          entry={sheet}
          plan={plan}
          verdicts={verdicts}
          foundIndex={foundIndex}
          onVerdict={answerQuery}
          onTryQuery={markTried}
          onClose={closeSheet}
          onSubmit={submitSummary}
        />,
        document.body,
      ) : null}
    </div>
  );
}
