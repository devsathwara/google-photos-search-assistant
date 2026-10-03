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
      className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] leading-5 ring-1 transition-colors ${
        selected
          ? "bg-[#e8f0fe] font-medium text-[#174ea6] ring-[#1a73e8]"
          : "bg-white text-[#202124] ring-[#dadce0] hover:bg-[#f8f9fa]"
      }`}
    >
      <span className="min-w-0 flex-1">
        {label}
        {hint ? <span className="mt-0.5 block truncate text-xs font-normal text-[#5f6368]">{hint}</span> : null}
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
        className="rise rounded-3xl border border-[#ceead6] bg-[#e6f4ea] p-5 text-center sm:p-6"
      >
        <p className="text-2xl" aria-hidden="true">
          🙏
        </p>
        <h2 className="mt-2 text-lg font-medium text-[#202124]">Thank you</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#3c4043]">
          Your answers go straight into the research for this project. Looking for another photo? Describe it above.
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
    subtitle = "Try the searches above in Google Photos, then tell us how it went.";
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
                className={`h-12 rounded-2xl text-base font-medium ring-1 ${
                  answers.helpful === value
                    ? "bg-[#1a73e8] text-white ring-[#1a73e8]"
                    : "bg-white text-[#202124] ring-[#dadce0] hover:bg-[#f8f9fa]"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-[#5f6368]">
            <span>Not helpful</span>
            <span>Very helpful</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[#202124]">Would you want this built into Google Photos search?</p>
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
          <label htmlFor="feedback-comment" className="text-sm font-medium text-[#202124]">
            Anything else? <span className="font-normal text-[#5f6368]">(optional)</span>
          </label>
          <textarea
            id="feedback-comment"
            rows={2}
            maxLength={500}
            value={answers.comment}
            onChange={(event) => setAnswers((a) => ({ ...a, comment: event.target.value }))}
            placeholder="What was confusing, or what would have helped?"
            className="mt-2 w-full resize-y rounded-2xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-base leading-6 outline-none placeholder:text-[#80868b] focus:border-[#1a73e8] focus:bg-white focus:ring-2 focus:ring-[#d2e3fc]"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={answers.helpful == null}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:bg-[#c6dafc]"
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
      className="scroll-mt-24 rounded-3xl border border-[#d2e3fc] bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08),0_8px_24px_rgba(60,64,67,0.06)] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-[#1a73e8]">
          Quick feedback · {step + 1} of {STEPS.length}
        </p>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-full px-3 py-1 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            ← Back
          </button>
        ) : null}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e8eaed]" aria-hidden="true">
        <div className="h-full rounded-full bg-[#1a73e8] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {preset && step >= 2 && typeof answers.foundVia === "number" ? (
        <p className="mt-4 rounded-2xl bg-[#e6f4ea] px-4 py-2.5 text-sm text-[#137333]">
          🎉 You found it with “{queries[answers.foundVia].query}”. A few quick questions.
        </p>
      ) : null}
      <h2 id="feedback-heading" className="mt-5 text-lg leading-7 font-medium text-[#202124]">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm leading-6 text-[#5f6368]">{subtitle}</p> : null}
      <div key={current + String(answers.found)} className="rise mt-4">
        {body}
      </div>
    </section>
  );
}
