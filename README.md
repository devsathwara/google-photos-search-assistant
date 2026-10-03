# Google Photos Search Assistant

A single-page helper for the NextLeap PM Fellowship graduation project. Describe a photo from memory. The app asks Grok for short [Google Photos](https://photos.google.com) search queries, likely reasons the search comes back empty, and steps to fix the most likely miss.

There is no backend. The page calls `https://api.x.ai/v1/chat/completions` from the browser with a key you paste in. The key is stored in `localStorage` on your device.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. Create a key at [console.x.ai](https://console.x.ai), paste it into the field at the top, and describe the photo.

## Model

Requests use `grok-4.3` with reasoning turned off. That is $1.25 per million input tokens and $2.50 per million output tokens, versus $2 and $6 for `grok-4.7`, which also spends extra tokens on reasoning. Prices: [docs.x.ai/developers/models](https://docs.x.ai/developers/models).

## Deploy on Vercel

Import this directory. `vercel.json` sets the Vite framework, build command, `dist` output, and a single-page rewrite. No environment variables are required, because each visitor brings their own API key.

```bash
npx vercel
```
