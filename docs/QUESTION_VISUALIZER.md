# Question Visualizer API

The image extraction backend accepts one image and returns a reviewable graph draft. It does not run an algorithm or accept model-generated code. Nodes, edges, costs, heuristics, and algorithm detection are suggestions; users should review uncertain fields before using the graph.

## API contract

`POST /api/analyze-question` with `Content-Type: application/json`:

```json
{"schemaVersion":1,"selectedAlgorithm":"bfs","image":{"mimeType":"image/png","base64":"..."}}
```

`selectedAlgorithm` is one of `bfs`, `dfs`, `ucs`, `greedy`, or `astar`. Images are PNG, JPEG, or WebP, with an 8 MB decoded limit. Success returns `{ "schemaVersion": 1, "draft": { "algorithm": null, "algorithmCandidates": [], "questionText": "", "directed": null, "startId": null, "goalId": null, "nodes": [{"id":"A","label":"A","heuristic":null,"x":0.5,"y":0.5}], "edges": [{"id":"e1","source":"A","target":"B","cost":null}] }, "uncertainties": [] }`. `algorithm` reports the detected algorithm and may be `null`; it is never forced to match the selected algorithm. Optional node positions are normalized to 0–1.

Errors use `{ "error": { "code": "...", "message": "...", "retryAfter": 60 } }`. Codes distinguish request/image errors, missing server configuration, Gemini quota/auth/service errors, timeout, and rate limiting. No error response includes a key or image data.

## Local setup

Use Node.js 20 or newer, copy `.env.example` to `.env`, and set `GEMINI_API_KEY` in `.env`. The key remains on the server; do not put it in JavaScript, HTML, or GitHub Pages secrets. Start `npm run dev` and open the printed localhost URL. `PORT` changes the local port. Optional `GEMINI_MODEL` defaults to `gemini-3.6-flash`. `GEMINI_TIMEOUT_MS` defaults to 60000 and is capped at 90000. The local server loads `.env` or `.dev.vars` and adds exact localhost CORS origins for its own port, even when `ALLOWED_ORIGINS` is also set. Production Worker CORS remains restricted to the configured exact origins.

## Cloudflare Worker setup

The Worker entry is `api/worker.js`, configured by `wrangler.jsonc`. Set the secret with `wrangler secret put GEMINI_API_KEY`. Configure `ALLOWED_ORIGINS` as a comma-separated list of exact deployed frontend origins (no wildcards); `GEMINI_MODEL` and `GEMINI_TIMEOUT_MS` can be changed in Worker variables. Deploy the Worker independently from the static site. The frontend default is `/api/analyze-question`; for separate static hosting, change `QUESTION_API_URL` in `js/question-api-config.js` to the Worker endpoint. Configure CORS on the Worker to include that frontend origin.

## Verification status

The automated browser flow uses a mocked API response. It verifies image upload, extraction review, explicit handling of missing edge costs and algorithm conflicts, graph editing, and local worker playback without contacting Gemini. No live Gemini request or deployment was performed as part of that check. Configure a server key to enable real image extraction.

Two local live checks using the configured server key returned HTTP 200 from Gemini. The end-to-end browser check reviewed a 9-node, 8-edge draft with start `S` and goal `E`, flagged algorithm ambiguity, and ran the local BFS worker. Playback showed route `S → B → H → G → E`, four moves, and unknown path cost; no costs were invented. A separate normalized response was retained locally for UI review but excluded from the repository because it contains user-provided question content. These are sample checks, not an accuracy evaluation. No Worker/API deployment was performed.

Gemini REST uses `generateContent` with image `inlineData` and JSON structured output. The default `gemini-3.6-flash` currently lists a free tier in Google’s pricing table. Availability, quotas, and pricing can change; the model is configurable and the backend does not switch models automatically. See [Gemini GenerateContent API](https://ai.google.dev/api/generate-content), [image understanding](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), and [pricing](https://ai.google.dev/gemini-api/docs/pricing).
