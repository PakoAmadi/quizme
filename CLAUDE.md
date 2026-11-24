# quizme — context for Claude

How to run the project, commands, env, API and code conventions are in [README.md](README.md). Read it first. This file records **decisions and their reasons**, the product requirements, and what comes next.

## Working with the user

- The user writes in Russian; answer in Russian. Code, comments, commit messages and docs are in English.
- **Never commit or push without an explicit request.** Leave changes in the working tree and suggest a commit message instead.
- Discuss design before writing large pieces of code; the user wants to understand and agree on the approach.
- The user prefers fixing IDE (WebStorm) warnings properly over suppressing them.

## Product requirements (agreed)

- **Users:** multi-user with registration. Roles: `admin`, `user` (more may come).
- **Topics:** nested tree (`parent_id`, recursive CTE).
- **Tests (quizzes):** each question has exactly 4 options, exactly 1 correct. An **explanation is required** for every question.
- **Test configuration** (stored as `settings jsonb`, described by a Zod schema in `@app/shared`):
  - question selection: fixed set, random sample from the topic pool, or both;
  - when to show the correct answer: after each question or at the end;
  - optional timer; shuffling of questions and/or options.
- **Vocabulary** is a special kind of test that runs on the same quiz engine. A word becomes a 4-option question on the fly: the correct translation plus 3 distractors from the same vocabulary. Required:
  - both directions (word → translation, translation → word);
  - **spaced repetition** (Leitner / SM-2): table `word_progress(user_id, word_id, box/ease, next_review_at)`;
  - transcription, examples, pronunciation (Web Speech API in the browser).
- **Adding content**, three ways: admin UI; import from JSON / CSV / Excel (with a preview step before saving); **LLM generation**.
- **Statistics with charts (ECharts):** score over time, progress per topic, hardest questions/words, activity heatmap and streak, average answer time.

## Technical decisions and why

- **Monorepo, npm workspaces:** `apps/api`, `apps/web`, `packages/shared`. One commit can change DB, API and UI together; Zod schemas are shared.
- **Backend: Node 24 + TypeScript without a build step** (native type stripping). `tsc` only type-checks. TypeScript is 7.x.
- **Own HTTP layer, no framework.** It started as the user's vanilla-JS project (`PakoAmadi/node-vanilla-ecommerce-api`, branch `clean`), ported to TS with the e-commerce domain removed. Keep its clean architecture: domain / application (ports) / infrastructure / interfaces, wired in `container.ts`.
- **No ORM:** `pg` + plain parameterized SQL; migrations are numbered `.sql` files. Statistics is mostly aggregate SQL, where an ORM would get in the way. Option for later: generate row types from the DB schema (e.g. `kanel`).
- **Validation: Zod 4** in `@app/shared`. The same schema validates on the backend (`validateBody`) and frontend (Angular signal forms support Standard Schema), and is exported via `z.toJSONSchema()` for LLM structured output.
- **Auth: server-side sessions now, bearer tokens later.** One backend, so JWT's stateless benefit doesn't matter, while sessions give instant logout/ban. `authStage` takes a list of strategies; `bearerTokenStrategy` and `HmacTokenService` exist but aren't wired in. CSRF uses the double-submit cookie with Angular's default names.
- **Frontend:** Angular 22 (standalone, signals, zoneless) + Tailwind 4 + ECharts (`ngx-echarts`). In dev, Angular proxies `/api` to `localhost:3000`; in prod, nginx serves both from one origin, so no CORS and cookies just work.

## LLM integration (designed, not built)

- **Provider-agnostic:** the provider is chosen in settings. Three adapters cover almost everything, using native `fetch` and no SDKs:
  - `openai-compatible`: OpenAI, OpenRouter, Mistral, Groq, DeepSeek, Ollama, LM Studio;
  - `anthropic`;
  - `gemini`.
- **Layers:** `generation-service` owns the domain (prompts, schemas, dedup). It calls `llm-client.complete({ system, messages, jsonSchema })`, and the client dispatches to an adapter that returns `{ text, usage }`.
- **Reliability:**
  - validate every result with the shared Zod schema;
  - on failure, retry 1–2 times, sending the validation errors back to the model;
  - pass existing questions in the prompt to avoid duplicates.
- **Review:** generated items are saved with `status = 'draft'` and an admin reviews them before publishing.
- **Async:**
  - `POST /admin/generation-jobs` returns a job id;
  - a worker processes jobs from a Postgres-table queue (`FOR UPDATE SKIP LOCKED`, no Redis);
  - the frontend follows progress via SSE or polling.
- **Tables:**
  - `llm_providers(adapter, base_url, model, api_key_enc, params, is_default, enabled)`. API keys are encrypted with AES-256-GCM using a master key from env, and are never sent to the frontend.
  - `generation_jobs(provider_id, kind, topic_id, request, status, error, input_tokens, output_tokens, ...)`.
- Questions and words get `source` (`manual | import | llm`), `status` (`draft | published | archived`) and `generation_job_id`.

## Data model draft (to finalize next)

```
topics           id, parent_id?, title, type ('quiz' | 'vocabulary')
tests            id, topic_id, title, settings jsonb
questions        id, topic_id, text, explanation NOT NULL, source, status
answer_options   id, question_id, text, is_correct   -- UNIQUE (question_id) WHERE is_correct
words            id, topic_id, term, translation, transcription?, example?, source, status
attempts         id, user_id, test_id, started_at, finished_at, score, total
attempt_answers  id, attempt_id, item_type, item_id, selected, is_correct, time_ms, snapshot jsonb
word_progress    user_id, word_id, box/ease, next_review_at
```

- `is_correct` is **never sent to the client** before the answer is submitted; only the server checks answers.
- `snapshot` keeps attempt history correct after a question is edited.

## Status

**Done** (`apps/api`):
- auth: register, login, logout, me, csrf;
- typed `pipe`;
- router with PATCH, query params and `Allow` on 405;
- migrations runner and `set-role` script;
- 157 tests passing.

The backend has **not yet been run against a real Postgres**.

**Next, in order:**
1. Full DB schema: the model above as migrations.
2. API endpoint list with permissions.
3. Zod schemas: topic, test, test settings, question, import formats.
4. Scaffold `apps/web` (Angular + Tailwind + proxy).
5. LLM client and generation jobs.

**Known limitations:** see the end of README.md.
