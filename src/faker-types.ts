import type { JsonSchemaObject } from "./types.js";

/** What a faker method returns when called without arguments. */
export type FakerOutput =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "bigint"
  | "object"
  | "array";

/**
 * Every @faker-js/faker v10 method that returns something other than a
 * string. Faker is not a runtime dependency, so this is a table; the smoke
 * tests call each method of the installed faker and compare.
 */
const nonStringOutputs: Record<string, FakerOutput> = {
  "number.int": "integer",
  "internet.port": "integer",
  "internet.httpStatusCode": "integer",

  "number.float": "number",
  "location.latitude": "number",
  "location.longitude": "number",

  "number.bigInt": "bigint",

  "datatype.boolean": "boolean",

  "date.anytime": "date",
  "date.past": "date",
  "date.future": "date",
  "date.recent": "date",
  "date.soon": "date",
  "date.birthdate": "date",
  "date.between": "date",

  "airline.airline": "object",
  "airline.airplane": "object",
  "airline.airport": "object",
  "finance.currency": "object",
  "location.language": "object",
  "science.chemicalElement": "object",
  "science.unit": "object",

  "color.cmyk": "array",
  "color.colorByCSSColorSpace": "array",
  "color.hsl": "array",
  "color.hwb": "array",
  "color.lab": "array",
  "color.lch": "array",
  "date.betweens": "array",
  "location.nearbyGPSCoordinate": "array",
};

/**
 * The output type of a faker method path. A path that is not in the table,
 * a caller's own included, is taken to return a string, as nearly all of
 * faker does.
 */
export function fakerOutput(path: string): FakerOutput {
  return nonStringOutputs[path] ?? "string";
}

/** Which faker outputs are valid values for each JSON Schema `type`. */
const accepts: Record<string, readonly FakerOutput[]> = {
  // json-schema-faker writes a Date or a number into a string property as
  // text (`"2026-08-12T10:06:40.000Z"`, `"8080"`), which is what a string
  // field called `createdAt` or `port` wants. An object or an array would
  // come out as `"[object Object]"` or a bare comma-joined list.
  string: ["string", "date", "integer", "number"],
  integer: ["integer"],
  number: ["integer", "number"],
  boolean: ["boolean"],
};

/**
 * Whether a faker method produces a value the node's `type` allows.
 *
 * A node without a `type` allows anything. With a list of types, one match
 * is enough.
 */
export function isCompatible(path: string, node: JsonSchemaObject): boolean {
  if (node.type === undefined) return true;
  const types = Array.isArray(node.type) ? node.type : [node.type];
  const output = fakerOutput(path);
  return types.some((type) => accepts[type]?.includes(output) ?? false);
}
