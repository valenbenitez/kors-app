# Snapshots visuales PDF cliente (COT-0010)

Baselines: `page-1.png`, `page-2.png`, `page-3.png`.

```bash
# Comparar (CI / local)
pnpm test src/lib/pdf/template.test.ts

# Regenerar baselines tras un cambio visual intencional
UPDATE_PDF_SNAPSHOTS=1 pnpm test src/lib/pdf/template.test.ts
```

Tolerancia: `pixelmatch` threshold 0.12, falla si >2.5% de píxeles difieren.

```bash
# PDF de muestra (no versionado; ver .gitignore)
GENERATE_SAMPLE_PDF=1 pnpm test src/lib/pdf/template.test.ts
# → docs/mvp/generated-COT-0010_cliente.pdf
```
