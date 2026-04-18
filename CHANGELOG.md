# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — 2026-04-18

Initial release.

- `annotate(schema, schemaName, options?)` — pure function that deep-clones a JSON Schema and annotates leaf properties with `faker` keywords for [`json-schema-faker`](https://github.com/json-schema-faker/json-schema-faker).
- Built-in dictionaries: ~130 schema-name aliases across 13 categories, extensive per-category field maps, a schema-agnostic generic field map, and JSON Schema `format` hints.
- Categories: `person`, `company`, `location`, `commerce`, `content`, `book`, `vehicle`, `animal`, `food`, `music`, `finance`, `media`, `airline`.
- Matching precedence: existing annotation → `format` hint → category-scoped field → generic field → `lorem.sentence` fallback.
- Compound schema names (`UserAccount`, `user_accounts`) split and retry with each part; pluralized names are singularized via `pluralize`.
- Exports the built-in dictionaries for inspection and extension.
