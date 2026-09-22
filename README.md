# annotate-json-schema

Preprocess a JSON Schema to annotate leaf properties with [`json-schema-faker`](https://github.com/json-schema-faker/json-schema-faker) `faker` keywords, so you can generate realistic mock data for web data models.

The clever part isn't traversal — it's guessing the right [`@faker-js/faker`](https://fakerjs.dev/) method from a schema name + field name. This library uses a large, hand-curated lookup dictionary: schema-name aliases (`user`/`owner`/`contact` → `person`), schema-scoped field aliases (`person.name` → `person.fullName`), generic field aliases (`emailAddress` → `internet.email`), and JSON Schema `format` hints. No ML, no fuzzy matching — just an exhaustive dictionary of best guesses.

## Install

```bash
npm install annotate-json-schema json-schema-faker @faker-js/faker
```

`json-schema-faker` is a peer dependency (its `JsonSchema` type is re-exported from this library); `@faker-js/faker` is what actually fulfils the `faker` keywords at generation time.

## Quick start

```ts
import { annotate } from "annotate-json-schema";

const schema = {
  type: "object",
  properties: {
    email: { type: "string" },
    firstName: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const annotated = annotate(schema, "User");
// {
//   type: "object",
//   properties: {
//     email:     { type: "string", faker: "internet.email" },
//     firstName: { type: "string", faker: "person.firstName" },
//     createdAt: { type: "string", format: "date-time", faker: "date.anytime" },
//   },
// }
```

Feed the result into `json-schema-faker` with a faker extension:

```ts
import { generate } from "json-schema-faker";
import { faker } from "@faker-js/faker";

const data = await generate(annotated, {
  extensions: { faker },
  alwaysFakeOptionals: true,
});
// {
//   email: 'Duncan85@hotmail.com',
//   firstName: 'Armando',
//   createdAt: '2025-07-30T12:43:06.000Z'
// }
```

## How matching works

For each leaf property, precedence is (first hit wins):

1. **Existing `faker` annotation** — if the node already has one and `preserveExisting` is `true` (default), it's kept.
2. **`enum` or `const`** — the node is left without an annotation, so json-schema-faker picks from the listed values (it would otherwise let `faker` override them).
3. **`format` hint** — e.g. `format: "uuid"` → `string.uuid`, `format: "email"` → `internet.email`.
4. **Category + field** — the schema name is singularized (via `pluralize`) and case-normalized, then looked up in `schemaAliases` to get a category (e.g. `Users` → `user` → `person`). The field name is then looked up in the per-category field map (e.g. `person.name` → `person.fullName`, `company.name` → `company.name`).
5. **Generic field** — a schema-agnostic fallback (e.g. `email` → `internet.email`, `createdAt` → `date.past`, `zipCode` → `location.zipCode`).
6. **Lorem fallback** — any unmatched `type: "string"` leaf gets `lorem.sentence` (toggle with `loremFallback: false`).

Compound schema names (`UserAccount`, `user_accounts`, `ReviewComments`) are split and their parts are tried as fallbacks, so `user_accounts.name` → `person.fullName` via the `user` alias.

## Traversal

`annotate` walks:

- `properties` — when the child is itself an object (has `properties` / `items` / etc.), the child's **property name becomes the new schema name** for that subtree. So `User.address.street` is matched with schemaName `address`, yielding `location.street`.
- `items` — including tuple-style arrays.
- `additionalProperties` (when it's a schema).
- `$defs` and `definitions` — each definition's key is used as its schema name.
- `oneOf` / `anyOf` / `allOf` — all branches are walked.

`$ref` nodes are left untouched — resolve refs before annotating.

The function is pure: it deep-clones the input and never mutates it.

## API

```ts
function annotate(
  schema: JSONSchema,
  schemaName: string,
  options?: AnnotateOptions,
): JSONSchema;

interface AnnotateOptions {
  /** Extend/override built-in schema-name → category aliases. */
  schemaAliases?: Record<string, string>;
  /** Extend/override built-in per-category field → faker path maps. */
  categoryFields?: Record<string, Record<string, string>>;
  /** Extend/override built-in generic field → faker path map. */
  genericFields?: Record<string, string>;
  /** Extend/override built-in JSON Schema `format` → faker path map. */
  formatHints?: Record<string, string>;
  /** Keep any pre-existing `faker` annotation. Default: true. */
  preserveExisting?: boolean;
  /** Assign `lorem.sentence` to unmatched string leaves. Default: true. */
  loremFallback?: boolean;
}
```

The built-in dictionaries are also exported if you want to inspect or re-use them:

```ts
import {
  schemaAliases,
  categoryFields,
  genericFields,
  formatHints,
} from "annotate-json-schema";
```

## Extending the dictionary

User-supplied entries merge on top of the built-ins (user wins on conflict):

```ts
annotate(schema, "Robot", {
  schemaAliases: { robot: "person" },
  categoryFields: {
    person: { serial: "string.nanoid" },
  },
  genericFields: {
    widgetid: "string.uuid",
  },
});
```

Lookup keys should be lowercase with non-alphanumerics stripped (`firstName`, `first_name`, `first-name` all normalize to `firstname`).

## Categories

The built-in `schemaAliases` covers ~130 common web-app entity names across these categories:

`person`, `company`, `location`, `commerce`, `content`, `book`, `vehicle`, `animal`, `food`, `music`, `finance`, `media`, `airline`.

Every emitted faker path is a real method in `@faker-js/faker` v10.
