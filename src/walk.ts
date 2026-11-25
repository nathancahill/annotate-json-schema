import { buildContext, matchField, type MatchContext } from "./match.js";
import type { AnnotateOptions, JsonSchema, JsonSchemaObject } from "./types.js";

/**
 * Deep-clone + recursively annotate a JSON Schema.
 *
 * Boolean schemas (`true` / `false` per JSON Schema 2020-12) are returned
 * as-is with no annotation.
 */
export function annotateSchema(
  schema: JsonSchema,
  schemaName: string,
  options?: AnnotateOptions,
): JsonSchema {
  const ctx = buildContext(options);
  const cloned = structuredClone(schema);
  if (isObjectSchema(cloned)) walk(cloned, schemaName, ctx);
  return cloned;
}

function walk(
  node: JsonSchemaObject,
  schemaName: string,
  ctx: MatchContext,
): void {
  if (typeof node.$ref === "string") return;

  if (node.properties) {
    for (const [propName, child] of Object.entries(node.properties)) {
      if (!isObjectSchema(child)) continue;
      if (isContainer(child)) {
        walk(child, propName, ctx);
      } else {
        const hit = matchField(schemaName, propName, child, ctx);
        if (hit !== undefined) {
          if (ctx.preserveExisting && typeof child.faker === "string") continue;
          child.faker = hit;
        }
      }
    }
  }

  if (isObjectSchema(node.items)) walk(node.items, schemaName, ctx);

  if (Array.isArray(node.prefixItems)) {
    for (const item of node.prefixItems) {
      if (isObjectSchema(item)) walk(item, schemaName, ctx);
    }
  }

  if (isObjectSchema(node.additionalProperties)) {
    walk(node.additionalProperties, schemaName, ctx);
  }

  if (node.$defs) {
    for (const [defName, def] of Object.entries(node.$defs)) {
      if (isObjectSchema(def)) walk(def, defName, ctx);
    }
  }

  // Draft-07 legacy alias for $defs — not in the upstream type but common
  // in the wild.
  const definitions = node["definitions"];
  if (definitions && typeof definitions === "object") {
    for (const [defName, def] of Object.entries(
      definitions as Record<string, JsonSchema>,
    )) {
      if (isObjectSchema(def)) walk(def, defName, ctx);
    }
  }

  for (const key of ["oneOf", "anyOf", "allOf"] as const) {
    const branches = node[key];
    if (Array.isArray(branches)) {
      for (const branch of branches) {
        if (isObjectSchema(branch)) walk(branch, schemaName, ctx);
      }
    }
  }
}

function isObjectSchema(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A "container" is a node that holds further structure to recurse into
 * (object with properties, array with items, or composite). Leaves are
 * anything else — that's where we attach a `faker` annotation.
 */
function isContainer(node: JsonSchemaObject): boolean {
  if (node.properties) return true;
  if (node.items) return true;
  if (node.prefixItems) return true;
  if (node.$defs || node["definitions"]) return true;
  if (node.oneOf || node.anyOf || node.allOf) return true;
  if (node.type === "object" || node.type === "array") return true;
  if (
    Array.isArray(node.type) &&
    (node.type.includes("object") || node.type.includes("array"))
  ) {
    return true;
  }
  return false;
}
