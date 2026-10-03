import { useEffect, useRef, useState } from "react";
import { analyzeMemory, MODEL } from "./api.js";
import { LoadingState, Results } from "./Results.jsx";

const STORAGE_KEY = "gpsa.xaiApiKey";
const EXAMPLE = "Photo of my dog at the park from last summer";

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

  function onKeyChange(event) {
    setApiKey(event.target.value.replace(/\s/g, ""));
    if (error) setError("");
  }

  function onDraftChange(event) {
    setDraft(event.target.value);
    if (error) setError("");
  }

  function fillExample() {
    setDraft(EXAMPLE);
    setError("");
    requestAnimationFrame(() => memoryRef.current?.focus());
  }

  async function onSubmit(event) {
    event.preventDefault();
    const description = draft.trim();
    const key = apiKey.trim();
    if (!description) {
      setError("Describe the photo you're looking for.");
      memoryRef.current?.focus();
      return;
    }
    if (!key) {
      setError("Add your xAI API key at the top. You can create one at console.x.ai.");
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
      });
      if (controller.signal.aborted) return;
      setResult({ description, plan });
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
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)] font-sans text-[#202124]">
      <header className="sticky top-0 z-20 border-b border-[#e8eaed] bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-start gap-3 px-4 py-3 sm:px-6">
          <Mark />
          <div className="min-w-0">
            <h1 className="text-[17px] leading-6 font-medium tracking-[-0.01em] sm:text-xl">
              Google Photos Search Assistant
            </h1>
            <p className="text-[13px] leading-5 text-[#5f6368]">
              AI-powered photo retrieval helper — Part of NextLeap PM Fellowship Graduation Project
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08),0_8px_24px_rgba(60,64,67,0.04)] sm:p-5">
          <form autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="api-key" className="text-sm font-medium text-[#202124] sm:w-28 sm:shrink-0">
                xAI API key
              </label>
              <div className="relative min-w-0 flex-1">
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
                  className="w-full rounded-full border border-[#dadce0] bg-[#f8f9fa] py-3 pr-20 pl-4 text-base text-[#202124] outline-none placeholder:text-[#80868b] focus:border-[#1a73e8] focus:bg-white focus:ring-2 focus:ring-[#d2e3fc]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((current) => !current)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full px-3 py-1.5 text-sm font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <p id="api-key-help" className="mt-3 text-xs leading-5 text-[#5f6368]">
              Saved in this browser only and sent to api.x.ai. Skip this on a shared computer.{" "}
              <a
                href="https://console.x.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1a73e8] underline-offset-2 hover:underline"
              >
                Get a key
              </a>
              {apiKey ? (
                <span className="mt-1 block font-medium text-[#188038]" aria-live="polite">
                  Saved in this browser
                </span>
              ) : null}
            </p>
          </form>
        </section>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08),0_8px_24px_rgba(60,64,67,0.06)] sm:p-6"
        >
          <label htmlFor="memory" className="text-lg font-medium text-[#202124]">
            Describe the photo you're looking for
          </label>
          <p id="memory-help" className="mt-1 text-sm leading-6 text-[#5f6368]">
            Names, places, colors, a rough year. Guesses are welcome.
          </p>
          <textarea
            ref={memoryRef}
            id="memory"
            name="memory"
            value={draft}
            onChange={onDraftChange}
            onKeyDown={onMemoryKeyDown}
            maxLength={4000}
            rows={5}
            aria-describedby="memory-help"
            placeholder="Describe the photo you're looking for... (e.g., 'beach sunset photo from last Diwali with family')"
            className="mt-4 min-h-[140px] w-full resize-y rounded-2xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-base leading-6 text-[#202124] outline-none placeholder:text-[#80868b] focus:border-[#1a73e8] focus:bg-white focus:ring-2 focus:ring-[#d2e3fc]"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white hover:bg-[#1558b0] disabled:cursor-wait disabled:bg-[#8ab4f8]"
            >
              {busy ? "Analyzing your memory..." : "Find My Photo"}
            </button>
            <button
              type="button"
              onClick={fillExample}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#dadce0] bg-white px-6 text-sm font-medium text-[#1a73e8] hover:bg-[#f8f9fa] disabled:opacity-60"
            >
              Try an example
            </button>
            <p className="hidden text-xs text-[#80868b] sm:block">Ctrl or ⌘ + Enter</p>
          </div>
          {error ? (
            <p role="alert" className="mt-4 rounded-2xl border border-[#f6aea9] bg-[#fce8e6] px-4 py-3 text-sm leading-6 text-[#a50e0e]">
              {error}
            </p>
          ) : null}
        </form>

        <Explainer />

        <div ref={resultsRef} className="scroll-mt-24">
          {busy ? <LoadingState /> : null}
          {status === "success" && result ? (
            <Results description={result.description} plan={result.plan} />
          ) : null}
        </div>

        <footer className="pb-4 text-xs leading-5 text-[#80868b]">
          This page does not read your Google Photos library. It only suggests what to type into search.
          Calls go from your browser to api.x.ai using {MODEL}. Not affiliated with Google.
        </footer>
      </main>
    </div>
  );
}

function Explainer() {
  return (
    <section
      aria-labelledby="explainer-heading"
      className="rounded-3xl border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.06)] sm:p-6"
    >
      <h2 id="explainer-heading" className="text-base font-medium text-[#202124]">
        What this tool does
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#3c4043]">
        Describe a photo the way you remember it, including the parts you are unsure about. The assistant
        turns that memory into short queries for the Google Photos search bar, then explains why the photo
        may still be missing and what to fix.
      </p>
      <h3 className="mt-5 text-base font-medium text-[#202124]">Why Google Photos search fails</h3>
      <ul className="mt-3 space-y-3">
        <li className="rounded-2xl bg-[#f8f9fa] px-4 py-3 text-sm leading-6 text-[#3c4043]">
          <span className="font-medium text-[#202124]">Camera roll only. </span>
          Search indexes backed-up camera photos. Pictures saved from WhatsApp, Instagram, or Downloads are
          usually skipped, even when the file is in your library.
        </li>
        <li className="rounded-2xl bg-[#f8f9fa] px-4 py-3 text-sm leading-6 text-[#3c4043]">
          <span className="font-medium text-[#202124]">Old phones and full storage. </span>
          Photos from a previous device never show up if backup was off. A full Google account can stop
          backup without a clear warning.
        </li>
        <li className="rounded-2xl bg-[#f8f9fa] px-4 py-3 text-sm leading-6 text-[#3c4043]">
          <span className="font-medium text-[#202124]">Unlabeled faces. </span>
          Searching a person's name only works after that face is labeled in the People album. Screenshots
          and forwarded photos can also lose the original date.
        </li>
      </ul>
    </section>
  );
}

function Mark() {
  return (
    <span
      className="grid h-11 w-11 shrink-0 grid-cols-2 grid-rows-2 gap-[3px] rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(60,64,67,0.16)] ring-1 ring-black/5"
      aria-hidden="true"
    >
      <span className="rounded-[4px] bg-[#4285F4]" />
      <span className="rounded-[4px] bg-[#EA4335]" />
      <span className="rounded-[4px] bg-[#FBBC04]" />
      <span className="rounded-[4px] bg-[#34A853]" />
    </span>
  );
}
