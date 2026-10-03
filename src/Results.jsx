import { useRef, useState } from "react";
import { sendFeedback } from "./api.js";
import { Feedback } from "./Feedback.jsx";
import { FolderCheck } from "./FolderCheck.jsx";

const STEPS = [
  "Open Google Photos on your phone, or photos.google.com in a browser where you are signed in.",
  "Tap Search.",
  "Type the query exactly as written, then run the search.",
  "If the grid is empty, keep the wording and try the next query.",
];

function photosUrl(query) {
  return `https://photos.google.com/search/${encodeURIComponent(query)}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function Likelihood({ value }) {
  const styles = {
    high: "bg-[#fce8e6] text-[#a50e0e] ring-[#f6aea9]",
    medium: "bg-white text-[#8a4b08] ring-[#f6d7a7]",
    low: "bg-white/80 text-[#5f6368] ring-[#e8eaed]",
  };
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[value] || styles.medium}`}>
      <span className="sr-only">Likelihood </span>
      {label}
    </span>
  );
}

export function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rise rounded-3xl border border-[#d2e3fc] bg-white px-5 py-10 text-center shadow-[0_1px_2px_rgba(60,64,67,0.08),0_8px_24px_rgba(60,64,67,0.06)]"
    >
      <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-[#d2e3fc] border-t-[#1a73e8]" />
      <p className="mt-4 text-lg font-medium text-[#202124]">Analyzing your memory...</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#5f6368]">
        Splitting it into short Google Photos searches, and checking why those searches come back empty.
      </p>
    </div>
  );
}

// Asked on the card itself once a query was opened or copied, so the
// question is waiting when the tester comes back from Google Photos.
function QueryVerdict({ verdict, onAnswer }) {
  const pill = "rounded-full px-4 py-2 text-sm font-medium ring-1";
  if (verdict === "found") {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#e6f4ea] px-4 py-3 ring-1 ring-[#ceead6]">
        <p className="text-sm font-medium text-[#137333]">🎉 This search found it</p>
        <button type="button" onClick={() => onAnswer(null)} className="text-sm font-medium text-[#5f6368] hover:underline">
          Change
        </button>
      </div>
    );
  }
  if (verdict === "miss") {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-[#e8eaed]">
        <p className="text-sm text-[#5f6368]">Not this one. Try the next search.</p>
        <button type="button" onClick={() => onAnswer(null)} className="text-sm font-medium text-[#5f6368] hover:underline">
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="rise mt-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#d2e3fc]">
      <p className="text-sm font-medium text-[#202124]">Did this search find your photo?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAnswer("found")} className={`${pill} bg-[#e6f4ea] text-[#137333] ring-[#ceead6] hover:bg-[#ceead6]`}>
          Found it
        </button>
        <button type="button" onClick={() => onAnswer("miss")} className={`${pill} bg-white text-[#3c4043] ring-[#dadce0] hover:bg-[#f8f9fa]`}>
          Not this one
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
      setCopyError("Clipboard access is blocked in this browser. Select the query and copy it manually.");
    }
  }

  const allQueries = plan.search_strategies.map((item) => item.query).join("\n");

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
    <div className="rise space-y-8">
      <div>
        <p className="text-sm text-[#5f6368]">
          {plan.search_strategies.length} searches
          <span aria-hidden="true"> · </span>
          {plan.diagnostics.length} reasons it might fail
          <span aria-hidden="true"> · </span>
          {plan.pro_tips.length} fixes
        </p>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#3c4043]">For “{description}”</p>
        <a
          href="#feedback"
          className="mt-3 inline-flex items-center rounded-full bg-[#e8f0fe] px-4 py-2 text-sm font-medium text-[#174ea6] hover:bg-[#d2e3fc]"
        >
          Tried the searches? Tell us how it went ↓
        </a>
      </div>

      <section aria-labelledby="strategies-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="strategies-heading" className="text-lg font-medium text-[#202124]">
            Search strategies
          </h2>
          <button
            type="button"
            onClick={() => copy("all", allQueries)}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
          >
            {copiedId === "all" ? "Copied" : "Copy all"}
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-[#5f6368]">
          Type these into the Google Photos search bar. Short phrases match. Full sentences do not.
        </p>

        <div className="mt-4 rounded-3xl border border-[#d2e3fc] bg-[#e8f0fe] p-4 sm:p-5">
          <h3 className="text-sm font-medium text-[#174ea6]">How to run each search</h3>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-2xl bg-white/80 px-3 py-3 text-sm leading-5 text-[#3c4043] ring-1 ring-[#d2e3fc]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-medium text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {copyError ? (
          <p role="alert" className="mt-3 text-sm text-[#a50e0e]">
            {copyError}
          </p>
        ) : null}

        <ul className="mt-3 space-y-3">
          {plan.search_strategies.map((item, index) => {
            const id = `query-${index}`;
            return (
              <li key={id} className="rounded-3xl border border-[#d2e3fc] bg-[#e8f0fe] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium tracking-wide text-[#174ea6]">Query {index + 1}</p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        markTried(index);
                        copy(id, item.query);
                      }}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1a73e8] ring-1 ring-[#d2e3fc] hover:bg-[#f8fbff]"
                    >
                      {copiedId === id ? "Copied" : "Copy"}
                    </button>
                    <a
                      href={photosUrl(item.query)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markTried(index)}
                      className="rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1558b0]"
                    >
                      Open
                    </a>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 text-[#1a73e8] ring-1 ring-[#d2e3fc]">
                  <SearchIcon />
                  <p className="min-w-0 flex-1 break-words text-base font-medium text-[#202124]">{item.query}</p>
                </div>
                <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-[#3c4043]">{item.explanation}</p>
                {tried.has(index) || verdicts[index] ? (
                  <QueryVerdict verdict={verdicts[index] ?? null} onAnswer={(verdict) => answerQuery(index, verdict)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="diagnostics-heading">
        <h2 id="diagnostics-heading" className="text-lg font-medium text-[#202124]">
          Why your search might fail
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#5f6368]">
          Likely reasons this photo stays hidden, highest chance first.
        </p>
        <ul className="mt-4 space-y-3">
          {plan.diagnostics.length === 0 ? (
            <li className="rounded-3xl border border-[#fde293] bg-[#fef7e0] p-4 text-sm leading-6 text-[#3c4043] sm:p-5">
              Nothing in this description points to one specific failure. Try the queries above, and confirm the photo was backed up from the camera roll.
            </li>
          ) : (
            plan.diagnostics.map((item, index) => (
              <li key={`${item.issue}-${index}`} className="rounded-3xl border border-[#fde293] bg-[#fef7e0] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium text-[#202124]">{item.issue}</h3>
                  <Likelihood value={item.likelihood} />
                </div>
                <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[#3c4043]">{item.explanation}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <FolderCheck />

      <section aria-labelledby="tips-heading">
        <h2 id="tips-heading" className="text-lg font-medium text-[#202124]">
          Pro tips
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#5f6368]">Steps that fix the most likely miss.</p>
        <ul className="mt-4 space-y-3">
          {plan.pro_tips.length === 0 ? (
            <li className="rounded-3xl border border-[#ceead6] bg-[#e6f4ea] p-4 text-sm leading-6 text-[#3c4043] sm:p-5">
              The assistant did not return extra fixes for this memory. Start with the queries above.
            </li>
          ) : (
            plan.pro_tips.map((item, index) => (
              <li key={`${item.tip}-${index}`} className="rounded-3xl border border-[#ceead6] bg-[#e6f4ea] p-4 sm:p-5">
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#188038] text-sm font-medium text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-[#202124]">{item.tip}</h3>
                    <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-[#3c4043]">{item.detail}</p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

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
  );
}
