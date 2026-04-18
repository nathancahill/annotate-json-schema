import pluralize from "pluralize";

/**
 * Lowercase, strip every non-alphanumeric character.
 *
 * `first_name`, `firstName`, `first-name`, and `First Name` all collapse
 * to `firstname`.
 */
export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Normalize a schema name into a dictionary lookup key: lowercase,
 * alphanumerics only, and singularized via `pluralize`.
 *
 * `Users` → `user`, `user_accounts` → `useraccount`.
 */
export function normalizeSchemaName(raw: string): string {
  return pluralize.singular(normalizeKey(raw));
}
