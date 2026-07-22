import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/catalog/parse-csv";

describe("parseCsv", () => {
  it("parses simple header + rows", () => {
    const { headers, rows } = parseCsv("a,b\n1,2\n3,4\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    const { rows } = parseCsv('id,payload\nx,"{""a"":1,""b"":2}"\n');
    expect(rows[0]?.payload).toBe('{"a":1,"b":2}');
  });

  it("skips blank lines", () => {
    const { rows } = parseCsv("id\n1\n\n2\n");
    expect(rows).toHaveLength(2);
  });
});
