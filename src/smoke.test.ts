import { faker } from "@faker-js/faker";
import { generate } from "json-schema-faker";
import { describe, expect, it } from "vitest";
import {
  annotate,
  categoryFields,
  formatHints,
  genericFields,
} from "./index.js";
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
