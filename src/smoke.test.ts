import { faker } from "@faker-js/faker";
import { generate } from "json-schema-faker";
import { describe, expect, it, vi } from "vitest";
import {
  annotate,
  categoryFields,
  formatHints,
  genericFields,
} from "./index.js";
import { fakerOutput } from "./faker-types.js";
import type { JsonSchema, JsonSchemaObject } from "./types.js";

function obj(schema: JsonSchema): JsonSchemaObject {
  if (typeof schema !== "object" || schema === null) {
    throw new Error(`expected object schema, got ${typeof schema}`);
  }
  return schema;
}

function collectFakerPaths(): Set<string> {
  const paths = new Set<string>();
  for (const map of Object.values(categoryFields)) {
    for (const p of Object.values(map)) paths.add(p);
  }
  for (const p of Object.values(genericFields)) paths.add(p);
  for (const p of Object.values(formatHints)) paths.add(p);
  return paths;
}

function resolveFakerMethod(path: string): unknown {
  const [mod, method] = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (faker as any)[mod]?.[method];
}

describe("smoke — every dictionary entry maps to a real faker method", () => {
  for (const path of collectFakerPaths()) {
    it(`${path} exists on faker`, () => {
      const fn = resolveFakerMethod(path);
      expect(typeof fn).toBe("function");
    });
  }
});

describe("smoke — every dictionary entry is callable without throwing", () => {
  for (const path of collectFakerPaths()) {
    it(`${path}() does not throw`, () => {
      const fn = resolveFakerMethod(path);
      expect(typeof fn).toBe("function");
      expect(() => (fn as () => unknown)()).not.toThrow();
    });
  }
});

/** Every `module.method` path on the installed faker. */
function allFakerPaths(): string[] {
  const paths: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules = faker as any as Record<string, unknown>;
  for (const mod of Object.keys(modules)) {
    const instance = modules[mod];
    // `helpers` methods take arguments and return whatever they are given.
    if (mod === "helpers" || mod.startsWith("_")) continue;
    if (typeof instance !== "object" || instance === null) continue;
    const names = new Set<string>();
    for (
      let proto = instance;
      proto && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto)
    ) {
      for (const name of Object.getOwnPropertyNames(proto)) names.add(name);
    }
    for (const name of names) {
      if (name === "constructor") continue;
      if (typeof (instance as Record<string, unknown>)[name] !== "function") {
        continue;
      }
      paths.push(`${mod}.${name}`);
    }
  }
  return paths;
}

function outputOf(value: unknown): string {
  if (value instanceof Date) return "date";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

describe("smoke — the output type table matches the installed faker", () => {
  const paths = new Set([...allFakerPaths(), ...collectFakerPaths()]);

  it("finds faker's methods", () => {
    expect(paths.size).toBeGreaterThan(200);
    expect(paths.has("number.int")).toBe(true);
  });

  for (const path of paths) {
    it(`${path} returns what the table says`, () => {
      // Deprecated methods warn; they are still methods a caller may name.
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = resolveFakerMethod(path) as () => unknown;
      const samples: unknown[] = [];
      try {
        for (let i = 0; i < 20; i++) samples.push(fn());
      } catch {
        // Needs arguments, so there is no output to compare. No dictionary
        // entry is one of these: see "callable without throwing" above.
        return;
      } finally {
        vi.restoreAllMocks();
      }

      const expected = fakerOutput(path);
      for (const sample of samples) {
        expect(outputOf(sample)).toBe(
          expected === "integer" ? "number" : expected,
        );
      }
      if (expected === "integer") {
        expect(samples.every((n) => Number.isInteger(n))).toBe(true);
      }
      if (expected === "number") {
        expect(samples.some((n) => !Number.isInteger(n))).toBe(true);
      }
    });
  }
});

describe("smoke — round-trip through json-schema-faker", () => {
  it("README example generates realistic data", async () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        email: { type: "string" },
        firstName: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
    };

    const annotated = annotate(schema, "User");
    const data = (await generate(annotated, {
      extensions: { faker },
      alwaysFakeOptionals: true,
    })) as Record<string, unknown>;

    expect(data.email).toBeDefined();
    expect(data.firstName).toBeDefined();
    expect(data.createdAt).toBeDefined();
  });

  it("annotated User schema generates realistic data", async () => {
    const schema: JsonSchema = {
      type: "object",
      required: [
        "id",
        "email",
        "firstName",
        "lastName",
        "bio",
        "createdAt",
        "address",
      ],
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        bio: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        address: {
          type: "object",
          required: ["street", "city", "country"],
          properties: {
            street: { type: "string" },
            city: { type: "string" },
            country: { type: "string" },
          },
        },
      },
    };

    const annotated = annotate(schema, "User");
    const data = (await generate(annotated, {
      extensions: { faker },
    })) as Record<string, unknown>;

    expect(typeof data.id).toBe("string");
    expect(String(data.id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(String(data.email)).toContain("@");
    expect(typeof data.firstName).toBe("string");
    expect(String(data.firstName).length).toBeGreaterThan(0);
    expect(typeof data.lastName).toBe("string");
    expect(typeof data.bio).toBe("string");

    const address = data.address as Record<string, unknown>;
    expect(typeof address.street).toBe("string");
    expect(typeof address.city).toBe("string");
    expect(typeof address.country).toBe("string");
  });

  it("annotated Company schema uses company faker paths", async () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name", "slogan"],
      properties: {
        name: { type: "string" },
        slogan: { type: "string" },
      },
    };
    const annotated = annotate(schema, "Company");
    const name = obj(obj(annotated).properties!.name);
    const slogan = obj(obj(annotated).properties!.slogan);
    expect(name.faker).toBe("company.name");
    expect(slogan.faker).toBe("company.catchPhrase");

    const data = (await generate(annotated, {
      extensions: { faker },
    })) as Record<string, unknown>;
    expect(typeof data.name).toBe("string");
    expect(String(data.name).length).toBeGreaterThan(0);
    expect(typeof data.slogan).toBe("string");
  });
});

describe("smoke — numbers stay numbers through json-schema-faker", () => {
  // A string hint on a number made json-schema-faker emit null.
  it("a required number named like a string hint generates a number", async () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["position", "year", "name"],
      properties: {
        position: { type: "number" },
        year: { type: "integer" },
        name: { type: "string" },
      },
    };

    for (const schemaName of ["User", "Stage", "Book"]) {
      const annotated = annotate(schema, schemaName);
      for (let i = 0; i < 20; i++) {
        const data = (await generate(annotated, {
          extensions: { faker },
        })) as Record<string, unknown>;
        expect(typeof data.position).toBe("number");
        expect(Number.isInteger(data.year)).toBe(true);
        expect(typeof data.name).toBe("string");
      }
    }
  });
});
