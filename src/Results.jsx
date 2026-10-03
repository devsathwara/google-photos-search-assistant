import { useEffect, useRef, useState } from "react";
import { sendFeedback } from "./api.js";
import { Feedback } from "./Feedback.jsx";
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

// Asked on the card itself once a query was opened or copied, so the
// question is waiting when the tester comes back from Google Photos.
function QueryVerdict({ verdict, onAnswer }) {
  if (verdict) {
    const found = verdict === "found";
    return (
      <div
        className={`mt-3 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm ${
          found ? "bg-good-soft text-good" : "bg-paper text-ink-3"
        }`}
      >
        <p className="font-medium">{found ? "✓ This search found it" : "Not this one. Try the next search."}</p>
        <button type="button" onClick={() => onAnswer(null)} className="min-h-8 px-1 font-medium text-ink-3 underline-offset-2 hover:underline">
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="rise mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-accent-soft px-3.5 py-2.5">
      <p className="text-sm font-medium text-ink">Did it find your photo?</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer("found")}
          className="min-h-9 rounded-full bg-good px-4 text-sm font-semibold text-white hover:bg-[#0f5a37]"
        >
          Yes, found it
        </button>
        <button
          type="button"
          onClick={() => onAnswer("miss")}
          className="min-h-9 rounded-full border border-line-strong bg-card px-4 text-sm font-medium text-ink-2 hover:text-ink"
        >
          No
        </button>
      </div>
    </div>
  );
}

export function Results({ description, plan, shownAt, tester }) {
  const [tried, setTried] = useState(() => new Set());
  const [verdicts, setVerdicts] = useState({});
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");
  const timer = useRef(0);

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
  }

  function answerQuery(index, verdict) {
    setVerdicts((current) => ({ ...current, [index]: verdict }));
    if (!verdict) return;
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
  const queryResults = Object.entries(verdicts)
    .filter(([, value]) => value)
    .map(([index, value]) => `${Number(index) + 1}:${value}`)
    .join(",");

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
                  <QueryVerdict verdict={verdicts[index] ?? null} onAnswer={(verdict) => answerQuery(index, verdict)} />
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

      <div className="mt-12">
        <Feedback
          key={foundIndex ?? "none"}
          description={description}
          plan={plan}
          shownAt={shownAt}
          tester={tester}
          foundIndex={foundIndex}
          queriesTried={tried.size}
          queryResults={queryResults}
        />
      </div>
    </div>
  );
}
