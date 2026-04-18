import type { JsonSchema } from "json-schema-faker";

/**
 * The object (non-boolean) form of a JSON Schema. Derived from the
 * canonical `JsonSchema` union so we stay aligned with the upstream shape.
 */
export type JsonSchemaObject = Exclude<JsonSchema, boolean>;

export type { JsonSchema };

export interface AnnotateOptions {
  /** Extend/override built-in schema-name → category aliases. */
  schemaAliases?: Record<string, string>;
  /** Extend/override built-in per-category field → faker path maps. */
  categoryFields?: Record<string, Record<string, string>>;
  /** Extend/override built-in generic field → faker path map. */
  genericFields?: Record<string, string>;
  /** Extend/override built-in JSON Schema `format` → faker path map. */
  formatHints?: Record<string, string>;
  /**
   * If true (default), nodes that already have a `faker` annotation are
   * left as-is. Set false to overwrite.
   */
  preserveExisting?: boolean;
  /**
   * If true (default), string leaves that don't match any rule get
   * `lorem.sentence` as a fallback.
   */
  loremFallback?: boolean;
}
