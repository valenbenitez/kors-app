# Convenciones de código
## Idioma del código
- **Código en inglés:** comentarios, JSDoc, mensajes de error de dominio, nombres de tests y strings internas van en inglés.
- **UI de producto en español:** labels, copy del wizard y textos orientados al usuario final pueden (y suelen) estar en español — eso es copy de producto, no “código”.
- **Campos de dominio existentes:** no renombrar identifiers del form wizard ya cableados en español (`clienteNombre`, `fechaIda`, `CotizacionFormInput`, etc.); son el modelo de producto. La capa Firestore usa inglés (`tripQuotes`, `TripQuoteDoc`). Solo strings humanas de UI y comentarios se escriben en inglés / español según la sección de idioma.
## Estilo general
| Aspecto | Convención |
|---------|-----------|
| TypeScript | `strict: true`, target ES6+ |
| Imports | Orden: externos → internos (`@/`) → relativos |
| Strings | Comillas dobles `"..."` siempre |
| Nombres de archivo | `kebab-case.ts` para componentes, `camelCase.ts` para utils |
| Nombres de componentes | `PascalCase.tsx` |
| Nombres de funciones/vars | `camelCase` |
| Constantes | `UPPER_SNAKE_CASE` |
| Tipos/interfaces | `PascalCase` |
## Archivos
- Un componente por archivo
- Un test por módulo; tests cerca del source o en `tests/`
- Cada archivo empieza con imports, sin comentarios de boilerplate
## Tests
- Framework del proyecto: Vitest (frontends) o Jest (backends NestJS)
- Tests descriptivos en inglés: `test("returns an error when the id does not exist")`
- Usar `describe` para agrupar casos relacionados
- Preferir datos reales a mocks; si se necesita mock, restaurar después
## Manejo de errores
- Excepciones del dominio con clases nombradas
- Mensajes de error de dominio en inglés
- Capturar en el borde del sistema (controller / route handler)
- Loggear con el logger del proyecto, no con `console`