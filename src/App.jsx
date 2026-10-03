import { useEffect, useRef, useState } from "react";
import { analyzeMemory, hasServerKey, MODEL } from "./api.js";
import { LoadingState, Results } from "./Results.jsx";

const STORAGE_KEY = "gpsa.xaiApiKey";

// One per research segment: cross-app sharer, Samsung migrant, large library.
const EXAMPLES = [
  {
    label: "WhatsApp photo from a cousin",
    text: "Me and my cousin doing garba at Navratri in 2023. She sent it to me on WhatsApp.",
  },
  {
    label: "From my old Samsung",
    text: "College trip to Goa with friends, around 2019. It was on my old Samsung phone before I switched.",
  },
  {
    label: "Somewhere in 20,000 photos",
    text: "My dog asleep on the grey sofa, sometime last winter.",
  },
];

const HINTS = ["Who was in it", "Where", "Roughly when", "How you got it"];

// Test links look like /?tester=samsung-1. The tag rides along with each
// feedback event so results can be split by segment.
function readTester() {
  try {
    return (new URLSearchParams(window.location.search).get("tester") ?? "").slice(0, 40);
  } catch {
    return "";
  }
}

function readStoredKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState(readStoredKey);
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  // null until the check finishes, so the key field doesn't flash for testers.
  const [serverKey, setServerKey] = useState(null);
  const [tester] = useState(readTester);
  const memoryRef = useRef(null);
  const resultsRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem(STORAGE_KEY, apiKey);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode can block storage. The key still works for this visit.
    }
  }, [apiKey]);

  useEffect(() => {
    if (status === "loading" || status === "success") {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status, result]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    let live = true;
    hasServerKey().then((configured) => {
      if (live) setServerKey(configured);
    });
    return () => {
      live = false;
    };
  }, []);

  function onKeyChange(event) {
    setApiKey(event.target.value.replace(/\s/g, ""));
    if (error) setError("");
  }

  function onDraftChange(event) {
    setDraft(event.target.value);
    if (error) setError("");
  }

  function applyExample(text) {
    setDraft(text);
    setError("");
    requestAnimationFrame(() => memoryRef.current?.focus());
  }

  async function onSubmit(event) {
    event.preventDefault();
    const description = draft.trim();
    const key = apiKey.trim();
    if (!description) {
      setError("Tell us a little about the photo first.");
      memoryRef.current?.focus();
      return;
    }
    if (!serverKey && !key) {
      setError("Add your xAI API key below. You can create one at console.x.ai.");
      document.getElementById("api-key")?.focus();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError("");
    setResult(null);

    try {
      const plan = await analyzeMemory({
        apiKey: key,
        description,
        signal: controller.signal,
        useServer: serverKey === true,
      });
      if (controller.signal.aborted) return;
      setResult({ description, plan, shownAt: Date.now() });
      setStatus("success");
    } catch (err) {
      if (err?.name === "AbortError" || controller.signal.aborted) return;
      setStatus("error");
      setError(err?.message || "Something went wrong. Try again.");
    }
  }

  function onMemoryKeyDown(event) {
    if (busy) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const busy = status === "loading";

  return (
    <div className="min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-ink">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-2.5 px-4 pt-5 sm:px-6 sm:pt-8">
        <Mark />
        <p className="text-[15px] leading-5 font-semibold tracking-[-0.01em]">
          Search Assistant <span className="font-normal text-ink-3">for Google Photos</span>
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-10 sm:px-6">
        <section className="pt-8 pb-6 sm:pt-12 sm:pb-8">
          <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.025em] sm:text-[40px]">
            Can't find a photo in Google&nbsp;Photos?
          </h1>
          <p className="mt-3 max-w-xl text-[17px] leading-7 text-ink-2">
            Describe it the way you remember it. You'll get the exact words to search, and the reason it
            might be hidden if search comes up empty.
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="rounded-[20px] border border-line bg-card p-4 shadow-[0_1px_0_rgba(28,27,25,0.04),0_12px_32px_-12px_rgba(28,27,25,0.12)] sm:p-5"
        >
          <label htmlFor="memory" className="text-[15px] font-semibold">
            What do you remember?
          </label>
          <p id="memory-help" className="mt-1 flex flex-wrap gap-x-1.5 text-sm leading-6 text-ink-3">
            {HINTS.map((hint, index) => (
              <span key={hint}>
                {hint}
                {index < HINTS.length - 1 ? <span aria-hidden="true"> ·</span> : null}
              </span>
            ))}
          </p>
          <textarea
            ref={memoryRef}
            id="memory"
            name="memory"
            value={draft}
            onChange={onDraftChange}
            onKeyDown={onMemoryKeyDown}
            maxLength={4000}
            rows={4}
            aria-describedby="memory-help"
            placeholder="e.g. Mom cutting the cake at my sister's wedding, Surat, 2021. Someone shared it in the family group."
            className="mt-3 min-h-[120px] w-full resize-y rounded-xl border border-line bg-paper/60 px-3.5 py-3 text-base leading-6 text-ink outline-none placeholder:text-ink-3/80 focus:border-ink focus:bg-card"
          />

          <div className="mt-3">
            <p className="text-xs font-medium text-ink-3">Or start from an example</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => applyExample(example.text)}
                  disabled={busy}
                  className="min-h-9 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          {serverKey === false ? (
            <div className="mt-4 rounded-xl border border-dashed border-line-strong p-3">
              <label htmlFor="api-key" className="text-sm font-medium">
                xAI API key
              </label>
              <div className="relative mt-2">
                <input
                  id="api-key"
                  name="xai-api-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={onKeyChange}
                  placeholder="Paste your key"
                  aria-describedby="api-key-help"
                  className="h-11 w-full rounded-lg border border-line bg-paper/60 pr-16 pl-3 text-base outline-none focus:border-ink focus:bg-card"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((current) => !current)}
                  className="absolute top-1/2 right-1.5 h-8 -translate-y-1/2 rounded-md px-2.5 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <p id="api-key-help" className="mt-2 text-xs leading-5 text-ink-3">
                Only needed when no shared key is set up. Saved in this browser and sent to api.x.ai.{" "}
                <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  Get a key
                </a>
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-3.5 py-3 text-sm leading-6 text-bad">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white hover:bg-[#33312d] disabled:cursor-wait disabled:opacity-60 sm:flex-none sm:px-8"
            >
              {busy ? "Working on it…" : "Find my photo"}
            </button>
            <p className="hidden text-xs text-ink-3 sm:block">or press Ctrl / ⌘ + Enter</p>
          </div>
        </form>

        <div ref={resultsRef} className="scroll-mt-4 pt-10">
          {busy ? <LoadingState /> : null}
          {status === "success" && result ? (
            <Results
              key={result.shownAt}
              description={result.description}
              plan={result.plan}
              shownAt={result.shownAt}
              tester={tester}
            />
          ) : null}
          {status === "idle" ? <HowItWorks /> : null}
        </div>

        <footer className="mt-14 border-t border-line pt-5 text-xs leading-5 text-ink-3">
          <p>
            This page never sees your photos. Your description is sent to xAI ({MODEL}) to write the searches.
            Not affiliated with Google.
          </p>
          <p className="mt-1">Built by Dev Sathwara as part of the NextLeap Product Management Fellowship.</p>
        </footer>
      </main>
    </div>
  );
}

// Shown before the first search, below the fold on phones. Three lines that
// set expectations, instead of a wall of explanation above the input.
function HowItWorks() {
  const steps = [
    ["Describe it", "Fuzzy is fine. Wrong year? Still useful."],
    ["Try the searches", "Each one opens straight in Google Photos."],
    ["Still missing?", "See why, usually a folder that never backed up."],
  ];
  return (
    <ol className="grid gap-5 sm:grid-cols-3 sm:gap-6">
      {steps.map(([title, text], index) => (
        <li key={title} className="flex gap-3 sm:block">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold text-ink-2">
            {index + 1}
          </span>
          <div className="sm:mt-3">
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="mt-0.5 text-sm leading-6 text-ink-3">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1c1b19" />
      <rect x="7" y="8" width="14" height="12" rx="2.5" fill="none" stroke="#f7f5f1" strokeWidth="2" />
      <path d="M9 18l3.5-3.5 2.5 2.5 1.5-1.5 2.5 2.5" fill="none" stroke="#f7f5f1" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="21" cy="20" r="4.5" fill="#1c1b19" stroke="#8fb0f2" strokeWidth="2" />
      <path d="M24.3 23.3l2.7 2.7" stroke="#8fb0f2" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
