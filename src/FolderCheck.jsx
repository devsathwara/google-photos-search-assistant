import { useState } from "react";

// Feature #5 (Cross-Folder Search Awareness). Shown on every result, not
// left to the model, because a photo in a folder that isn't backed up can't
// be found by any query.
const PLATFORMS = {
  android: {
    label: "Android",
    intro:
      "Only the Camera folder backs up by default. Photos in these folders stay on the phone, and Google Photos search can't find them until you turn on backup for that folder.",
    folders: ["WhatsApp Images", "Screenshots", "Download", "Instagram", "Telegram", "Snapchat"],
    steps: [
      "In Google Photos, open Collections (Library on older versions), then On this device.",
      "Open each folder above. If it says Not backed up, turn on Back up.",
      "Tap your profile picture. If it says backup is paused or storage is full, fix that first.",
    ],
  },
  iphone: {
    label: "iPhone",
    intro:
      "Google Photos backs up your Photos library, but only what's in it. Photos saved inside other apps never reach it.",
    folders: ["WhatsApp", "Telegram", "Instagram", "Files / Downloads"],
    steps: [
      "In WhatsApp, go to Settings → Chats and turn on Save to Photos. Do the same in other chat apps.",
      "In iPhone Settings → Google Photos → Photos, choose Full Access. Limited Access backs up only the photos you picked.",
      "Tap your profile picture in Google Photos. If it says backup is paused or storage is full, fix that first.",
    ],
  },
};

export function FolderCheck() {
  const [platform, setPlatform] = useState("android");
  const current = PLATFORMS[platform];

  return (
    <section aria-labelledby="folders-heading">
      <h2 id="folders-heading" className="text-lg font-medium text-[#202124]">
        Check which folders are searchable
      </h2>
      <p className="mt-1 text-sm leading-6 text-[#5f6368]">
        Search only covers photos that are backed up. Check this before trying more queries.
      </p>

      <div className="mt-4 rounded-3xl border border-[#e8eaed] bg-white p-4 sm:p-5">
        <div role="tablist" aria-label="Phone type" className="inline-flex rounded-full bg-[#f1f3f4] p-1">
          {Object.entries(PLATFORMS).map(([id, item]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={platform === id}
              onClick={() => setPlatform(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                platform === id ? "bg-white text-[#1a73e8] shadow-sm" : "text-[#5f6368]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-[#3c4043]">{current.intro}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {current.folders.map((folder) => (
            <li key={folder} className="rounded-full bg-[#fef7e0] px-3 py-1 text-xs font-medium text-[#8a4b08] ring-1 ring-[#fde293]">
              {folder}
            </li>
          ))}
        </ul>
        <ol className="mt-4 space-y-2">
          {current.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6 text-[#3c4043]">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1f3f4] text-xs font-medium text-[#202124]">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
