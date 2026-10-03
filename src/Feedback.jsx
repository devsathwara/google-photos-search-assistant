import { useState } from "react";
import { sendFeedback } from "./api.js";

// The MVP stands in for a native Google Photos feature, so each answer maps
// to a Part 4 / Part 7 metric:
//   found + found_via   -> AI-Assisted Search Success Rate (primary, >=60%)
//   tried_before        -> baseline: was this photo already "lost"?
//   setting_change      -> backup action rate (secondary, >=30%)
//   helpful, want_native -> satisfaction and desirability
const MISS_REASONS = [
  { id: "no_results", label: "No results at all" },
  { id: "wrong_photos", label: "Photos, but not the one I wanted" },
  { id: "not_in_library", label: "I think it's not in my library" },
  { id: "not_tried", label: "Didn't get to try yet" },
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

const STEPS = ["found", "detail", "before", "setting", "rate"];

function Choice({ label, hint, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] leading-5 transition-colors ${
        selected
          ? "border-ink bg-paper font-semibold text-ink"
          : "border-line bg-card text-ink hover:border-line-strong"
      }`}
    >
      <span className="min-w-0 flex-1">
        {label}
        {hint ? <span className="mt-0.5 block truncate text-xs font-normal text-ink-3">{hint}</span> : null}
      </span>
    </button>
  );
}

// Remounted (via key) when a query card is marked "Found it", so the first
// two questions start answered and the card opens on question 3.
export function Feedback({ description, plan, shownAt, tester, foundIndex, queriesTried, queryResults }) {
  const preset = foundIndex != null;
  const [step, setStep] = useState(preset ? 2 : 0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState({
    found: preset ? true : null,
    foundVia: preset ? foundIndex : null,
    missReason: null,
    triedBefore: null,
    settingChange: null,
    helpful: null,
    wantNative: null,
    comment: "",
  });

  const queries = plan.search_strategies;

  function answer(patch) {
    setAnswers((current) => ({ ...current, ...patch }));
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function submit() {
    const via = answers.foundVia;
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
      queriesTried,
      queryResults,
      topDiagnostic: plan.diagnostics[0]?.issue ?? "",
      description,
      shownAt,
    });
    setDone(true);
  }

  if (done) {
    return (
      <section
        id="feedback"
        aria-live="polite"
        className="rise rounded-2xl border border-line bg-card p-6 text-center"
      >
        <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Thank you</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-6 text-ink-2">
          Your answers go straight into the research behind this project. Looking for another photo? Describe it
          at the top.
        </p>
      </section>
    );
  }

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  let title = "";
  let subtitle = "";
  let body = null;

  if (current === "found") {
    title = "Did you find your photo?";
    subtitle = "Once you've tried the searches above.";
    body = (
      <div className="grid gap-2 sm:grid-cols-2">
        <Choice label="Found it!" selected={answers.found === true} onClick={() => answer({ found: true, missReason: null })} />
        <Choice label="Not yet" selected={answers.found === false} onClick={() => answer({ found: false, foundVia: null })} />
      </div>
    );
  } else if (current === "detail" && answers.found) {
    title = "Which search got you there?";
    body = (
      <div className="grid gap-2">
        {queries.map((item, index) => (
          <Choice
            key={item.query}
            label={`“${item.query}”`}
            hint={`Search ${index + 1}`}
            selected={answers.foundVia === index}
            onClick={() => answer({ foundVia: index })}
          />
        ))}
        <Choice
          label="Something else"
          hint="My own search, scrolling, or an album"
          selected={answers.foundVia === "other"}
          onClick={() => answer({ foundVia: "other" })}
        />
      </div>
    );
  } else if (current === "detail") {
    title = "What did you see?";
    body = (
      <div className="grid gap-2">
        {MISS_REASONS.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={answers.missReason === item.id}
            onClick={() => answer({ missReason: item.id })}
          />
        ))}
      </div>
    );
  } else if (current === "before") {
    title = "Had you looked for this photo before today?";
    body = (
      <div className="grid gap-2">
        {TRIED_BEFORE.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={answers.triedBefore === item.id}
            onClick={() => answer({ triedBefore: item.id })}
          />
        ))}
      </div>
    );
  } else if (current === "setting") {
    title = "Did this page get you to change anything in Google Photos?";
    body = (
      <div className="grid gap-2">
        {SETTING_CHANGES.map((item) => (
          <Choice
            key={item.id}
            label={item.label}
            selected={answers.settingChange === item.id}
            onClick={() => answer({ settingChange: item.id })}
          />
        ))}
      </div>
    );
  } else {
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
                  answers.helpful === value
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-card text-ink hover:border-line-strong"
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

  return (
    <section
      id="feedback"
      aria-labelledby="feedback-heading"
      className="scroll-mt-4 rounded-2xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(28,27,25,0.04),0_12px_32px_-12px_rgba(28,27,25,0.12)] sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-ink-3">
          Help us improve this · {step + 1} of {STEPS.length}
        </p>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="min-h-8 rounded-full px-3 text-sm font-medium text-ink-3 hover:bg-paper hover:text-ink"
          >
            ← Back
          </button>
        ) : null}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper" aria-hidden="true">
        <div className="h-full rounded-full bg-ink transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {preset && step >= 2 && typeof answers.foundVia === "number" ? (
        <p className="mt-4 rounded-xl bg-good-soft px-3.5 py-2.5 text-sm font-medium text-good">
          ✓ You found it with “{queries[answers.foundVia].query}”. A few quick questions.
        </p>
      ) : null}
      <h2 id="feedback-heading" className="mt-4 text-[20px] leading-7 font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm leading-6 text-ink-2">{subtitle}</p> : null}
      <div key={current + String(answers.found)} className="rise mt-4">
        {body}
      </div>
    </section>
  );
}
