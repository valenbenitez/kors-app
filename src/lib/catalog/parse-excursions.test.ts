import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/catalog/parse-csv";
import { parseEditorialCsvRows } from "@/lib/catalog/parse-editorial";
import { parseExcursionCsvRows } from "@/lib/catalog/parse-excursions";

const VALID_EXCURSION_CSV = `id,nombre,activa,destino,moneda,neto,precioMenor,politicaMenores,proveedor,observaciones,notas,tipo,validezDesde,validezHasta,categoriaPaquete
exc-test-1,Tour Cataratas,true,Iguazú,USD,100,,Mismo adulto,Prov,obs,notas,Excursion,,,Base
exc-test-2,,true,Iguazú,USD,50,,Mismo adulto,Prov,,,Excursion,,,Base
exc-test-3,Otro Tour,true,Iguazú,USD,80,,Mismo adulto,Prov,,,Excursion,,,Base
`;

describe("parseExcursionCsvRows", () => {
  it("parses valid rows and reports invalid without aborting", () => {
    const { rows } = parseCsv(VALID_EXCURSION_CSV);
    const results = parseExcursionCsvRows(rows);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ ok: true, row: 2 });
    if (results[0]?.ok) {
      expect(results[0].value.id).toBe("exc-test-1");
      expect(results[0].value.nombreLimpio.length).toBeGreaterThan(0);
      expect(results[0].value.precioMenor).toBeNull();
    }
    expect(results[1]).toMatchObject({ ok: false, row: 3 });
    expect(results[2]).toMatchObject({ ok: true, row: 4 });
  });
});

describe("parseEditorialCsvRows", () => {
  it("parses tips payload and rejects bad JSON", () => {
    const csv = `destino,tipo,payload
Iguazú,tips,"[{""emoji"":""🦟"",""title"":""A"",""body"":""B""}]"
Iguazú,tips,not-json
Iguazú,packing,"{""title"":""Pack"",""items"":[{""emoji"":""🎒"",""title"":""T"",""body"":""B""}]}"
`;
    const { rows } = parseCsv(csv);
    const results = parseEditorialCsvRows(rows);

    expect(results[0]).toMatchObject({ ok: true, row: 2 });
    if (results[0]?.ok) {
      expect(results[0].value.tipo).toBe("tips");
      expect(Array.isArray(results[0].value.payload)).toBe(true);
    }
    expect(results[1]).toMatchObject({ ok: false, row: 3 });
    expect(results[2]).toMatchObject({ ok: true, row: 4 });
  });
});
