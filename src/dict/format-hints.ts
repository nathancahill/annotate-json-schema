/**
 * JSON Schema `format` keyword → faker method path.
 *
 * When a node declares a known format, this mapping takes priority over
 * field-name heuristics.
 */
export const formatHints: Record<string, string> = {
  email: "internet.email",
  "idn-email": "internet.email",
  uri: "internet.url",
  "uri-reference": "internet.url",
  iri: "internet.url",
  "iri-reference": "internet.url",
  url: "internet.url",
  uuid: "string.uuid",
  ipv4: "internet.ipv4",
  ipv6: "internet.ipv6",
  hostname: "internet.domainName",
  "idn-hostname": "internet.domainName",
  date: "date.anytime",
  "date-time": "date.anytime",
  time: "date.anytime",
  password: "internet.password",
  byte: "string.alphanumeric",
  binary: "string.binary",
};
