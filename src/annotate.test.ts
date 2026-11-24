import { describe, expect, it } from "vitest";
import { annotate } from "./index.js";
import type { JsonSchema, JsonSchemaObject } from "./types.js";

/** Narrow a JsonSchema to its object form — throws on boolean schemas. */
function obj(schema: JsonSchema): JsonSchemaObject {
  if (typeof schema !== "object" || schema === null) {
    throw new Error(`expected object schema, got ${typeof schema}`);
  }
  return schema;
}

function prop(schema: JsonSchema, name: string): JsonSchemaObject {
  const root = obj(schema);
  const child = root.properties?.[name];
  if (child === undefined) throw new Error(`missing property ${name}`);
  return obj(child);
}

describe("annotate — README example", () => {
  it("annotates email fields via internet.email", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { email: { type: "string" } },
    };
    const out = annotate(schema, "User");
    expect(prop(out, "email").faker).toBe("internet.email");
  });
});

describe("annotate — category routing via schemaAliases", () => {
  it("Owner.name → person.fullName", () => {
    const out = annotate(
      { type: "object", properties: { name: { type: "string" } } },
      "Owner",
    );
    expect(prop(out, "name").faker).toBe("person.fullName");
  });

  it("Company.name → company.name", () => {
    const out = annotate(
      { type: "object", properties: { name: { type: "string" } } },
      "Company",
    );
    expect(prop(out, "name").faker).toBe("company.name");
  });

  it("Product.name → commerce.productName", () => {
    const out = annotate(
      { type: "object", properties: { name: { type: "string" } } },
      "Product",
    );
    expect(prop(out, "name").faker).toBe("commerce.productName");
  });

  it("Book.title → book.title", () => {
    const out = annotate(
      { type: "object", properties: { title: { type: "string" } } },
      "Book",
    );
    expect(prop(out, "title").faker).toBe("book.title");
  });
});

describe("annotate — pluralization", () => {
  it("Users behaves like User", () => {
    const a = annotate(
      { type: "object", properties: { email: { type: "string" } } },
      "Users",
    );
    const b = annotate(
      { type: "object", properties: { email: { type: "string" } } },
      "User",
    );
    expect(prop(a, "email").faker).toBe(prop(b, "email").faker);
    expect(prop(a, "email").faker).toBe("internet.email");
  });

  it("Companies → company category", () => {
    const out = annotate(
      { type: "object", properties: { name: { type: "string" } } },
      "Companies",
    );
    expect(prop(out, "name").faker).toBe("company.name");
  });
});

describe("annotate — format hint takes priority", () => {
  it("format uuid wins over field name", () => {
    const out = annotate(
      {
        type: "object",
        properties: { nickname: { type: "string", format: "uuid" } },
      },
      "Random",
    );
    expect(prop(out, "nickname").faker).toBe("string.uuid");
  });

  it("format date-time", () => {
    const out = annotate(
      {
        type: "object",
        properties: { whatever: { type: "string", format: "date-time" } },
      },
      "Random",
    );
    expect(prop(out, "whatever").faker).toBe("date.anytime");
  });
});

describe("annotate — nested objects use inner property name as schemaName", () => {
  it("User.address.street → location.streetAddress (full single line)", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: { street: { type: "string" } },
          },
        },
      },
      "User",
    );
    expect(prop(prop(out, "address"), "street").faker).toBe(
      "location.streetAddress",
    );
  });

  it("User.address.streetName → location.street (just the name)", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: { streetName: { type: "string" } },
          },
        },
      },
      "User",
    );
    expect(prop(prop(out, "address"), "streetName").faker).toBe(
      "location.street",
    );
  });

  it("User.address.streetAddress → location.streetAddress", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: { streetAddress: { type: "string" } },
          },
        },
      },
      "User",
    );
    expect(prop(prop(out, "address"), "streetAddress").faker).toBe(
      "location.streetAddress",
    );
  });
});

describe("annotate — generic fallbacks", () => {
  it("unknown schema, common field still matches generically", () => {
    const out = annotate(
      { type: "object", properties: { email: { type: "string" } } },
      "RandomWidget",
    );
    expect(prop(out, "email").faker).toBe("internet.email");
  });

  it("lorem fallback for unknown string fields", () => {
    const out = annotate(
      { type: "object", properties: { foobar: { type: "string" } } },
      "RandomWidget",
    );
    expect(prop(out, "foobar").faker).toBe("lorem.sentence");
  });

  it("no annotation for non-string unknown fields", () => {
    const out = annotate(
      { type: "object", properties: { count: { type: "integer" } } },
      "RandomWidget",
    );
    expect(prop(out, "count").faker).toBeUndefined();
  });
});

describe("annotate — hints respect the property type", () => {
  it("position: number gets no string hint, in a person schema or any other", () => {
    for (const schemaName of ["User", "Stage", "RandomWidget"]) {
      const out = annotate(
        { type: "object", properties: { position: { type: "number" } } },
        schemaName,
      );
      expect(prop(out, "position").faker).toBeUndefined();
    }
  });

  it("position: string still gets person.jobTitle", () => {
    const out = annotate(
      { type: "object", properties: { position: { type: "string" } } },
      "User",
    );
    expect(prop(out, "position").faker).toBe("person.jobTitle");
  });

  it("year: integer keeps a numeric hint where the dictionary has one", () => {
    const out = annotate(
      { type: "object", properties: { year: { type: "integer" } } },
      "Book",
    );
    expect(prop(out, "year").faker).toBe("number.int");
  });

  it("year: integer with no numeric hint is left to the schema", () => {
    const out = annotate(
      { type: "object", properties: { year: { type: "integer" } } },
      "Song",
    );
    expect(prop(out, "year").faker).toBeUndefined();
  });

  it("an integer does not take a hint that returns floats", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          latitude: { type: "integer" },
          longitude: { type: "number" },
        },
      },
      "Place",
    );
    expect(prop(out, "latitude").faker).toBeUndefined();
    expect(prop(out, "longitude").faker).toBe("location.longitude");
  });

  it("a string hint is not put on a number, integer or boolean", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          price: { type: "number" },
          title: { type: "integer" },
          name: { type: "boolean" },
        },
      },
      "Product",
    );
    expect(prop(out, "price").faker).toBeUndefined();
    expect(prop(out, "title").faker).toBeUndefined();
    expect(prop(out, "name").faker).toBeUndefined();
  });

  it("falls through to the next rule when a hint has the wrong type", () => {
    // The person category says `position` is a job title. On a number that
    // is passed over, and the caller's generic entry gets its turn.
    const out = annotate(
      { type: "object", properties: { position: { type: "number" } } },
      "User",
      { genericFields: { position: "number.int" } },
    );
    expect(prop(out, "position").faker).toBe("number.int");
  });

  it("a string keeps hints that return a number or a date", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          port: { type: "string" },
          createdAt: { type: "string" },
        },
      },
      "RandomWidget",
    );
    expect(prop(out, "port").faker).toBe("internet.port");
    expect(prop(out, "createdAt").faker).toBe("date.past");
  });

  it("a string named after a hint that returns an object falls back to lorem", () => {
    const out = annotate(
      { type: "object", properties: { airline: { type: "string" } } },
      "Flight",
    );
    expect(prop(out, "airline").faker).toBe("lorem.sentence");
  });

  it("a format hint is checked the same way", () => {
    const out = annotate(
      {
        type: "object",
        properties: { stamp: { type: "integer", format: "date-time" } },
      },
      "RandomWidget",
    );
    expect(prop(out, "stamp").faker).toBeUndefined();
  });

  it("with a list of types, one compatible type is enough", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          position: { type: ["string", "null"] },
          rank: { type: ["number", "null"] },
        },
      },
      "User",
      { genericFields: { rank: "person.jobTitle" } },
    );
    expect(prop(out, "position").faker).toBe("person.jobTitle");
    expect(prop(out, "rank").faker).toBeUndefined();
  });

  it("a property without a type takes any hint", () => {
    const out = annotate(
      { type: "object", properties: { position: {}, pages: {} } },
      "Book",
      { genericFields: { position: "person.jobTitle" } },
    );
    expect(prop(out, "position").faker).toBe("person.jobTitle");
    expect(prop(out, "pages").faker).toBe("number.int");
  });

  it("an explicit faker on the node is kept whatever its type", () => {
    const out = annotate(
      {
        type: "object",
        properties: { position: { type: "number", faker: "person.jobTitle" } },
      },
      "User",
    );
    expect(prop(out, "position").faker).toBe("person.jobTitle");
  });
});

describe("annotate — enum and const", () => {
  it("leaves an enum leaf to json-schema-faker, even when the name matches", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["dog", "cat"] },
          email: { type: "string", enum: ["a@example.com"] },
        },
      },
      "Pet",
    );
    expect(prop(out, "kind").faker).toBeUndefined();
    expect(prop(out, "email").faker).toBeUndefined();
  });

  it("leaves a const leaf alone, including const null", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          status: { type: "string", const: "draft" },
          note: { type: ["string", "null"], const: null },
        },
      },
      "Post",
    );
    expect(prop(out, "status").faker).toBeUndefined();
    expect(prop(out, "note").faker).toBeUndefined();
  });

  it("keeps a faker the caller put on an enum leaf", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["dog"], faker: "animal.dog" },
        },
      },
      "Pet",
      { preserveExisting: false },
    );
    expect(prop(out, "kind").faker).toBe("animal.dog");
  });
});

describe("annotate — preserveExisting", () => {
  it("keeps an existing faker annotation by default", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          email: { type: "string", faker: "internet.exampleEmail" },
        },
      },
      "User",
    );
    expect(prop(out, "email").faker).toBe("internet.exampleEmail");
  });

  it("overwrites when preserveExisting=false", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          email: { type: "string", faker: "internet.exampleEmail" },
        },
      },
      "User",
      { preserveExisting: false },
    );
    expect(prop(out, "email").faker).toBe("internet.email");
  });
});

describe("annotate — purity", () => {
  it("does not mutate the input schema", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { email: { type: "string" } },
    };
    const before = JSON.stringify(schema);
    annotate(schema, "User");
    expect(JSON.stringify(schema)).toBe(before);
  });
});

describe("annotate — arrays and $defs", () => {
  it("recurses into array items", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: { email: { type: "string" } },
            },
          },
        },
      },
      "Team",
    );
    const items = obj(obj(prop(out, "users").items as JsonSchema));
    expect(prop(items, "email").faker).toBe("internet.email");
  });

  it("recurses into $defs using each def name as schemaName", () => {
    const out = annotate(
      {
        $defs: {
          Company: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      },
      "Root",
    );
    const defs = obj(out).$defs!;
    expect(prop(defs.Company, "name").faker).toBe("company.name");
  });
});

describe("annotate — boolean schemas", () => {
  it("returns boolean schemas untouched", () => {
    expect(annotate(true, "User")).toBe(true);
    expect(annotate(false, "User")).toBe(false);
  });

  it("skips boolean child schemas during traversal", () => {
    const out = annotate(
      {
        type: "object",
        properties: {
          email: { type: "string" },
          anything: true,
        },
      },
      "User",
    );
    expect(prop(out, "email").faker).toBe("internet.email");
    expect(obj(out).properties!.anything).toBe(true);
  });
});

describe("annotate — user-supplied extensions", () => {
  it("extra generic alias is respected", () => {
    const out = annotate(
      { type: "object", properties: { widgetid: { type: "string" } } },
      "Widget",
      { genericFields: { widgetid: "string.uuid" } },
    );
    expect(prop(out, "widgetid").faker).toBe("string.uuid");
  });

  it("extra schema alias routes to a category", () => {
    const out = annotate(
      { type: "object", properties: { name: { type: "string" } } },
      "Robot",
      { schemaAliases: { robot: "person" } },
    );
    expect(prop(out, "name").faker).toBe("person.fullName");
  });
});
