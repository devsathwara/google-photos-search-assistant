import { useEffect, useRef, useState } from "react";

// Feedback is asked when the tester comes back from Google Photos, not at
// the bottom of the page. Each answer maps to a Part 4 / Part 7 metric:
//   verdict / found + which -> AI-Assisted Search Success Rate (>=60%)
//   before                  -> baseline: was this photo already "lost"?
//   setting                 -> backup action rate (>=30%)
//   rate                    -> satisfaction and desirability
const MISS_REASONS = [
  { id: "no_results", label: "No results at all" },
  { id: "wrong_photos", label: "Photos, but not the one I wanted" },
  { id: "not_in_library", label: "I think it's not in my library" },
  { id: "not_tried", label: "I didn't really try" },
];

const TRIED_BEFORE = [
  { id: "failed_before", label: "Yes, but I couldn't find it" },
  { id: "found_before", label: "Yes, and I found it then" },
  { id: "first_time", label: "No, this was my first try" },
];

const SETTING_CHANGES = [
  { id: "folder_backup", label: "Turned on backup for a folder" },
  { id: "checked_backup", label: "Checked my backup or storage" },
  { id: "named_face", label: "Named someone in People" },
  { id: "none", label: "Nothing yet" },
];

const WANT_NATIVE = [
  { id: "yes", label: "Yes" },
  { id: "maybe", label: "Maybe" },
  { id: "no", label: "No" },
];

const REST = ["before", "setting", "rate"];

function photosUrl(query) {
  return `https://photos.google.com/search/${encodeURIComponent(query)}`;
}

function Choice({ label, hint, selected, onClick, tone }) {
  const toneClass =
    tone === "good"
      ? "border-good bg-good text-white hover:bg-[#0f5a37]"
      : selected
        ? "border-ink bg-paper font-semibold text-ink"
        : "border-line bg-card text-ink hover:border-line-strong";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-12 w-full items-center rounded-xl border px-4 py-3 text-left text-[15px] leading-5 transition-colors ${toneClass} ${
        tone === "good" ? "font-semibold" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        {label}
        {hint ? <span className="mt-0.5 block truncate text-xs font-normal text-ink-3">{hint}</span> : null}
      </span>
    </button>
  );
}

function initialState(entry, foundIndex) {
  if (entry.type === "query") {
    return { path: ["verdict"], answers: { found: null, foundVia: null } };
  }
  if (foundIndex != null) {
    return { path: REST, answers: { found: true, foundVia: foundIndex } };
  }
  return { path: ["found"], answers: { found: null, foundVia: null } };
}

export function FeedbackSheet({ entry, plan, verdicts, foundIndex, onVerdict, onTryQuery, onClose, onSubmit }) {
  const queries = plan.search_strategies;
  const [state] = useState(() => initialState(entry, foundIndex));
  const [path, setPath] = useState(state.path);
  const [pos, setPos] = useState(0);
  const [nextIndex, setNextIndex] = useState(null);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState({
    ...state.answers,
    missReason: null,
    triedBefore: null,
    settingChange: null,
    helpful: null,
    wantNative: null,
    comment: "",
  });
  const panelRef = useRef(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const step = path[pos];
  const queryIndex = entry.type === "query" ? entry.index : null;

  function advance(newPath, patch) {
    if (patch) setAnswers((a) => ({ ...a, ...patch }));
    if (newPath) setPath(newPath);
    setPos((p) => p + 1);
  }

  function firstUntried(exclude) {
    const order = [...queries.keys()].filter((i) => i !== exclude);
    const after = order.filter((i) => i > exclude && !verdicts[i]);
    const before = order.filter((i) => i < exclude && !verdicts[i]);
    return after[0] ?? before[0] ?? null;
  }

  function answerVerdict(value) {
    if (value === "later") return onClose();
    onVerdict(queryIndex, value);
    if (value === "found") {
      advance(["verdict", ...REST], { found: true, foundVia: queryIndex });
      return;
    }
    const next = firstUntried(queryIndex);
    setNextIndex(next);
    if (next != null) advance(["verdict", "next"], { found: false });
    else advance(["verdict", "miss", ...REST], { found: false });
  }

  function submit() {
    onSubmit(answers);
    setDone(true);
  }

  // The path grows as answers come in, so assume at least four questions.
  const progress = done ? 100 : ((pos + 1) / Math.max(path.length, 4)) * 100;

  let title = "";
  let subtitle = "";
  let body = null;

  if (step === "verdict") {
    title = `Did “${queries[queryIndex].query}” find your photo?`;
    body = (
      <div className="grid gap-2">
        <Choice label="Yes, found it" tone="good" onClick={() => answerVerdict("found")} />
        <Choice label="No, not there" onClick={() => answerVerdict("miss")} />
        <Choice label="I haven't looked yet" onClick={() => answerVerdict("later")} />
      </div>
    );
  } else if (step === "next") {
    const next = queries[nextIndex];
    title = `Try search ${nextIndex + 1} next`;
    subtitle = "Different words often catch what the first search missed.";
    body = (
      <div className="grid gap-2">
        <a
          href={photosUrl(next.query)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onTryQuery(nextIndex);
            onClose();
          }}
          className="flex min-h-12 items-center gap-2.5 rounded-xl border border-ink bg-ink px-4 py-3 text-white hover:bg-[#33312d]"
        >
          <span className="min-w-0 flex-1 text-[15px] font-semibold">Open “{next.query}”</span>
          <span aria-hidden="true">↗</span>
        </a>
        <Choice label="I'm done searching" onClick={() => advance(["verdict", "next", "miss", ...REST])} />
      </div>
    );
  } else if (step === "found") {
    title = "Did you find your photo?";
    body = (
      <div className="grid gap-2">
        <Choice label="Yes, found it" tone="good" onClick={() => advance(["found", "which", ...REST], { found: true })} />
        <Choice label="Not yet" onClick={() => advance(["found", "miss", ...REST], { found: false })} />
      </div>
    );
  } else if (step === "which") {
    title = "Which search got you there?";
    body = (
      <div className="grid gap-2">
        {queries.map((item, index) => (
          <Choice
            key={item.query}
            label={`“${item.query}”`}
            hint={`Search ${index + 1}`}
            selected={answers.foundVia === index}
            onClick={() => {
              onVerdict(index, "found");
              advance(null, { foundVia: index });
            }}
          />
        ))}
        <Choice
          label="Something else"
          hint="My own search, scrolling, or an album"
          selected={answers.foundVia === "other"}
          onClick={() => advance(null, { foundVia: "other" })}
        />
      </div>
    );
  } else if (step === "miss") {
    title = "What did you see in Google Photos?";
    body = (
      <div className="grid gap-2">
        {MISS_REASONS.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={answers.missReason === item.id}
            onClick={() => advance(null, { missReason: item.id })}
          />
        ))}
      </div>
    );
  } else if (step === "before") {
    title = "Had you looked for this photo before today?";
    body = (
      <div className="grid gap-2">
        {TRIED_BEFORE.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={answers.triedBefore === item.id}
            onClick={() => advance(null, { triedBefore: item.id })}
          />
        ))}
      </div>
    );
  } else if (step === "setting") {
    title = "Did this page get you to change anything in Google Photos?";
    body = (
      <div className="grid gap-2">
        {SETTING_CHANGES.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={answers.settingChange === item.id}
            onClick={() => advance(null, { settingChange: item.id })}
          />
        ))}
      </div>
    );
  } else if (step === "rate") {
    title = "Last one: how helpful was this?";
    body = (
      <div className="space-y-5">
        <div>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Helpfulness from 1 to 5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={answers.helpful === value}
                onClick={() => setAnswers((a) => ({ ...a, helpful: value }))}
                className={`h-12 rounded-xl border text-base font-semibold ${
                  answers.helpful === value ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:border-line-strong"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-3">
            <span>Not helpful</span>
            <span>Very helpful</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Would you want this built into Google Photos search?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {WANT_NATIVE.map((item) => (
              <Choice
                key={item.id}
                label={item.label}
                selected={answers.wantNative === item.id}
                onClick={() => setAnswers((a) => ({ ...a, wantNative: item.id }))}
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="feedback-comment" className="text-sm font-semibold">
            Anything else? <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <textarea
            id="feedback-comment"
            rows={2}
            maxLength={500}
            value={answers.comment}
            onChange={(event) => setAnswers((a) => ({ ...a, comment: event.target.value }))}
            placeholder="What was confusing, or what would have helped?"
            className="mt-2 w-full resize-y rounded-xl border border-line bg-paper/60 px-3.5 py-3 text-base leading-6 outline-none placeholder:text-ink-3/80 focus:border-ink focus:bg-card"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={answers.helpful == null}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white hover:bg-[#33312d] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {answers.helpful == null ? "Pick a rating to send" : "Send feedback"}
        </button>
      </div>
    );
  }

  const foundQuery = typeof answers.foundVia === "number" ? queries[answers.foundVia].query : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="sheet relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-card px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(28,27,25,0.18)] outline-none sm:max-w-md sm:rounded-3xl sm:pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper" aria-hidden="true">
            <div className="h-full rounded-full bg-ink transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          {pos > 0 && !done ? (
            <button
              type="button"
              onClick={() => setPos((p) => p - 1)}
              className="min-h-8 rounded-full px-2.5 text-sm font-medium text-ink-3 hover:bg-paper hover:text-ink"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="rise py-6 text-center">
            <h2 id="sheet-title" className="text-[22px] font-semibold tracking-[-0.01em]">
              Thank you
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-6 text-ink-2">
              Your answers go straight into the research behind this project.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex h-11 items-center rounded-full border border-line-strong px-6 text-sm font-semibold hover:border-ink"
            >
              Close
            </button>
          </div>
        ) : (
          <div key={`${step}-${pos}`} className="rise">
            {foundQuery && REST.includes(step) ? (
              <p className="mt-4 rounded-xl bg-good-soft px-3.5 py-2.5 text-sm font-medium text-good">
                ✓ Found with “{foundQuery}”. Three quick questions.
              </p>
            ) : null}
            <h2 id="sheet-title" className="mt-4 text-[20px] leading-7 font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm leading-6 text-ink-2">{subtitle}</p> : null}
            <div className="mt-4">{body}</div>
          </div>
        )}
      </div>
    </div>
  );
}
