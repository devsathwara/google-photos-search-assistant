import { useState } from "react";

// Feature #5 (Cross-Folder Search Awareness). Shown on every result, not
// left to the model, because a photo in a folder that isn't backed up can't
// be found by any query.
const PLATFORMS = {
  android: {
    label: "Android",
    intro: "Only the Camera folder backs up on its own. These stay on your phone, invisible to search, until you switch each one on:",
    folders: ["WhatsApp Images", "Screenshots", "Download", "Instagram", "Telegram", "Snapchat"],
    steps: [
      "In Google Photos, open Collections (Library on older versions), then On this device.",
      "Open each folder above. If it says Not backed up, turn on Back up.",
      "Tap your profile picture. If backup is paused or storage is full, fix that first.",
    ],
  },
  iphone: {
    label: "iPhone",
    intro: "Google Photos backs up your Photos library, but only what's in it. Photos saved inside these apps never reach it:",
    folders: ["WhatsApp", "Telegram", "Instagram", "Files"],
    steps: [
      "In WhatsApp, go to Settings → Chats and turn on Save to Photos. Do the same in other chat apps.",
      "In iPhone Settings → Google Photos → Photos, choose Full Access. Limited Access backs up only photos you picked.",
      "Tap your profile picture in Google Photos. If backup is paused or storage is full, fix that first.",
    ],
  },
};

export function FolderCheck() {
  const [platform, setPlatform] = useState("android");
  const current = PLATFORMS[platform];

  return (
    <div className="mt-8 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="folders-heading" className="text-base font-semibold">
          Check which folders back up
        </h3>
        <div role="tablist" aria-label="Your phone" className="inline-flex rounded-full bg-paper p-1 ring-1 ring-line">
          {Object.entries(PLATFORMS).map(([id, item]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={platform === id}
              onClick={() => setPlatform(id)}
              className={`min-h-8 rounded-full px-3.5 text-sm font-medium ${
                platform === id ? "bg-card text-ink shadow-[0_1px_2px_rgba(28,27,25,0.12)]" : "text-ink-3 hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-ink-2">{current.intro}</p>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {current.folders.map((folder) => (
          <li key={folder} className="rounded-md border border-line bg-paper px-2 py-0.5 font-mono text-[13px] text-ink-2">
            {folder}
          </li>
        ))}
      </ul>
      <ol className="mt-4 space-y-2.5">
        {current.steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-6 text-ink-2">
            <span className="w-4 shrink-0 font-semibold text-ink-3">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
