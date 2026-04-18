# Contributing

## Setup

```bash
npm install
```

## Scripts

- `npm run build` — produce `dist/` via Vite.
- `npm run dev` — build in watch mode.
- `npm test` — run the Vitest suite.
- `npm run test:watch` — tests in watch mode.
- `npm run lint:ts` — typecheck with `tsc --noEmit`.
- `npm run lint:format` — Prettier check.

## Where to add entries

Most contributions are dictionary additions. Pick the right file under `src/dict/`:

- `schema-aliases.ts` — add an entity name (singular, lowercase) that should route to an existing category. e.g. `podcaster: "person"`.
- `category-fields.ts` — add a field that's meaningful only within a specific category. e.g. under `vehicle`, `trim: "vehicle.model"`.
- `generic-fields.ts` — add a field that's useful regardless of the surrounding schema. e.g. `webhook: "internet.url"`.
- `format-hints.ts` — add a JSON Schema `format` → faker mapping.

### Rules

1. **No invented faker methods.** Every value must be a real method path in [`@faker-js/faker`](https://fakerjs.dev/api/) v10. If unsure, check the docs or grep the faker source.
2. **Keys are pre-normalized.** Lowercase, alphanumerics only, singular for schema aliases. `firstName`, `first_name`, and `first-name` all normalize to `firstname` — so only register the compact form.
3. **Don't introduce new categories lightly.** Prefer adding to `person`, `company`, `location`, `commerce`, `content`, etc. New categories are only worth it when a faker module exists that warrants its own namespace.
4. **No fuzzy matching.** Lookup is exact after normalization; if a word should match, add it to the dictionary.

## Tests

Every non-trivial change should come with a test in `src/annotate.test.ts`. Prefer tests that assert the full `(schemaName, fieldName) → faker path` contract, not implementation details.

```bash
npm test
```

## Commit style

Conventional-ish, short and imperative — e.g. `add podcaster alias to person category`, `fix location.timeZone typo`.

## Publishing

Release is manual: bump `package.json` version, `npm run build`, commit, tag, `npm publish`. The `prepare` script re-runs the build on install.
