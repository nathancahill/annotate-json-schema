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

Rules 3 to 5 are guesses from a name, and a name says nothing about the type: `position` is a job title on a string and a rank on a number. So a hint only counts when its faker method returns a value the property's `type` allows; otherwise the next rule is tried.

| property `type`               | hints that apply                                                       |
| ----------------------------- | ---------------------------------------------------------------------- |
| `string`                      | methods returning a string, a `Date` or a number (written out as text) |
| `number`                      | methods returning a number (`number.int`, `location.latitude`, …)      |
| `integer`                     | methods returning an integer (`number.int`, `internet.port`, …)        |
| `boolean`                     | `datatype.boolean`                                                     |
| none                          | any                                                                    |
| a list (`["string", "null"]`) | whatever any one of its types allows                                   |

A `number` or `integer` property with no numeric hint gets no annotation, so json-schema-faker generates it from the schema's own `minimum` / `maximum` / `multipleOf`. (A string hint on a number used to make json-schema-faker emit `null`.) A method path the library does not know, one of your own included, is taken to return a string. An explicit `faker` on the node (rule 1) is never checked.

json-schema-faker uses a `faker` value as it comes, without checking it against the rest of the schema. So, as with `enum` and `const`, constraints a hint would override are left to json-schema-faker:

- a leaf with a `pattern` gets no annotation at all;
- a leaf with `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` or `multipleOf` gets no numeric hint (`number.int` alone ranges up to 2^53);
- a string with a `maxLength` gets no lorem fallback. A name hint is still applied (`firstName` with `maxLength: 100` gets `person.firstName`), and is not checked against the limit.

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
