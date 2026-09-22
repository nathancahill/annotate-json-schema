import {
  categoryFields as builtinCategoryFields,
  formatHints as builtinFormatHints,
  genericFields as builtinGenericFields,
  schemaAliases as builtinSchemaAliases,
} from "./dict/index.js";
import { normalizeKey, normalizeSchemaName } from "./normalize.js";
import type { AnnotateOptions, JsonSchemaObject } from "./types.js";

export interface MatchContext {
  schemaAliases: Record<string, string>;
  categoryFields: Record<string, Record<string, string>>;
  genericFields: Record<string, string>;
  formatHints: Record<string, string>;
  preserveExisting: boolean;
  loremFallback: boolean;
}

/**
 * Merge user-supplied options with the built-in dictionaries. User entries
 * take priority.
 */
export function buildContext(options: AnnotateOptions = {}): MatchContext {
  const categoryFields: Record<string, Record<string, string>> = {};
  for (const [cat, fields] of Object.entries(builtinCategoryFields)) {
    categoryFields[cat] = { ...fields };
  }
  if (options.categoryFields) {
    for (const [cat, fields] of Object.entries(options.categoryFields)) {
      categoryFields[cat] = { ...(categoryFields[cat] ?? {}), ...fields };
    }
  }

  return {
    schemaAliases: { ...builtinSchemaAliases, ...(options.schemaAliases ?? {}) },
    categoryFields,
    genericFields: { ...builtinGenericFields, ...(options.genericFields ?? {}) },
    formatHints: { ...builtinFormatHints, ...(options.formatHints ?? {}) },
    preserveExisting: options.preserveExisting ?? true,
    loremFallback: options.loremFallback ?? true,
  };
}

function isStringLeaf(node: JsonSchemaObject): boolean {
  if (node.type === "string") return true;
  if (Array.isArray(node.type) && node.type.includes("string")) return true;
  return false;
}

/**
 * Determine the faker method path for a leaf schema node, given the
 * surrounding schema name and field name.
 *
 * Precedence:
 *   1. Existing `faker` annotation (when `preserveExisting`)
 *   2. No annotation for a leaf with `enum` or `const`
 *   3. `format` hint
 *   4. Category-scoped field map (schemaName → category → field)
 *   5. Generic field map
 *   6. `lorem.sentence` fallback for string leaves (when `loremFallback`)
 */
export function matchField(
  schemaName: string,
  fieldName: string,
  node: JsonSchemaObject,
  ctx: MatchContext,
): string | undefined {
  if (ctx.preserveExisting && typeof node.faker === "string") {
    return node.faker;
  }

  // The schema already lists the valid values. json-schema-faker prefers
  // `faker` over `enum` and `const`, so an annotation would replace them with
  // values the schema rejects.
  if (Array.isArray(node.enum) || "const" in node) return undefined;

  if (typeof node.format === "string") {
    const hit = ctx.formatHints[node.format];
    if (hit) return hit;
  }

  const fieldKey = normalizeKey(fieldName);

  // Try the schema name first, then walk into split parts (for multi-word
  // names like "UserProfile" — "profile" is a useful fallback).
  const schemaKeys = schemaNameLookupOrder(schemaName);
  for (const key of schemaKeys) {
    const category = ctx.schemaAliases[key];
    if (!category) continue;
    const categoryMap = ctx.categoryFields[category];
    if (!categoryMap) continue;
    const hit = categoryMap[fieldKey];
    if (hit) return hit;
  }

  const generic = ctx.genericFields[fieldKey];
  if (generic) return generic;

  if (ctx.loremFallback && isStringLeaf(node)) {
    return "lorem.sentence";
  }

  return undefined;
}

/**
 * Produce lookup candidates for a schema name, most specific first:
 *   "UserProfile" → ["userprofile", "profile", "user"]
 */
function schemaNameLookupOrder(raw: string): string[] {
  const primary = normalizeSchemaName(raw);
  const parts = raw
    .split(/(?=[A-Z])|[^a-zA-Z0-9]+/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const singularParts = parts
    .map(normalizeSchemaName)
    .filter((p) => p && p !== primary);
  // Prefer the tail word (often the head noun in English) before the head.
  const order = [primary, ...singularParts.reverse()];
  return Array.from(new Set(order));
}
