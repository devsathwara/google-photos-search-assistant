# Google Photos Search Assistant

A single-page helper for the NextLeap PM Fellowship graduation project. Describe a photo from memory. The app asks Grok for short [Google Photos](https://photos.google.com) search queries, likely reasons the search comes back empty, and steps to fix the most likely miss.

There are two ways to call Grok:

- With `XAI_API_KEY` set on Vercel, the page calls `api/analyze.js`, which forwards the description to xAI with that key. Visitors never see a key field. Use this for user testing.
- Without it, the page shows a key field and calls `https://api.x.ai/v1/chat/completions` straight from the browser. The pasted key is stored in `localStorage` on that device.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. Create a key at [console.x.ai](https://console.x.ai), paste it into the field at the top, and describe the photo.

## Model

Requests use `grok-4.3` with reasoning turned off. That is $1.25 per million input tokens and $2.50 per million output tokens, versus $2 and $6 for `grok-4.7`, which also spends extra tokens on reasoning. Prices: [docs.x.ai/developers/models](https://docs.x.ai/developers/models).

`npm run dev` has no `/api` routes, so it always shows the key field. Run `npx vercel dev` to try the shared-key path locally.

## Deploy on Vercel

Import this directory. `vercel.json` sets the Vite framework, build command, `dist` output, and a single-page rewrite that leaves `/api/*` alone. Add `XAI_API_KEY` under Project → Settings → Environment Variables, then redeploy. Each call is capped at 1,500 output tokens, which keeps one search well under a cent.

## Test sessions

Give each tester a tagged link, such as `https://<your-app>.vercel.app/?tester=samsung-1` or `?tester=crossapp-2`. Feedback is asked when the tester comes back from Google Photos. After they open or copy a search and return to the page, a sheet slides up: "Did this search find your photo?" A yes leads to three short questions (had they looked before, did they change a setting, how helpful was it). A no points them to the next search, or to the same questions if they're done. Every search is asked about separately, including after the tester has submitted: a miss also asks what that search showed. The session questions (looked before, setting changed, rating) are asked once. A sticky "Done searching? Tell us how it went" bar covers testers who never leave the page.

Each search answer is logged as its own row (`kind` = `query`, with `miss_reason` on a miss), and the finished questions as one `summary` row with the tester tag, outcome, winning search, what they saw on a miss, whether they had looked before, any setting they changed, a 1–5 helpfulness rating, whether they'd want it in Google Photos, an optional comment, how many searches they tried and how each went, the top diagnosis, the description (first 300 characters), and seconds from results to submit.

To collect answers in a Google Sheet:

1. Create a blank Google Sheet. Open Extensions → Apps Script, replace the code with `docs/feedback-sheet.gs`, and save.
2. Click Deploy → New deployment → Web app. Set "Execute as" to Me and "Who has access" to Anyone. Authorize, then copy the `/exec` URL.
3. In Vercel, add `SHEET_WEBHOOK_URL` with that URL and redeploy.

Each answer then appears as a new row. The same event is also printed to the Vercel logs (search `mvp_feedback`), but the free plan keeps those for about an hour.

```bash
npx vercel
```
