# Convenciones de código
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
- Tests descriptivos: `test("devuelve error cuando el id no existe")`
- Usar `describe` para agrupar casos relacionados
- Preferir datos reales a mocks; si se necesita mock, restaurar después
## Manejo de errores
- Excepciones del dominio con clases nombradas
- Capturar en el borde del sistema (controller / route handler)
- Loggear con el logger del proyecto, no con `console`