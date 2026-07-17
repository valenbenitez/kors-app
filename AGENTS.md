# AGENTS.md — Mapa de navegación para agentes de IA

> Este archivo es el **punto de entrada**. No es una biblia de reglas: es un
> **mapa**. Lee solo lo que necesites (divulgación progresiva).

---

## 1. Producto (qué es este repo)

kors-app — app web Next.js para que los vendedores de Madero (agencia de
viajes) generen cotizaciones de viaje por su cuenta. Un wizard guía la carga
de datos, aplica la fórmula de cálculo v2.8 (con `Decimal`, sin floats) sobre
el catálogo real de Madero (excursiones, mapas, tips) y produce un PDF de
cotización con el brand de la agencia. Reemplaza el flujo manual del skill
`/cotizar-madero` que corría en Claude Code — sin LLM en runtime.

## 2. Cómo desarrollar

- **Instalar:** `pnpm install`
- **Desarrollo local:** `pnpm dev`
- **Tests:** `pnpm test` (Vitest; `pnpm test:watch` para modo watch)
- **Build:** `pnpm build`
- **Lint:** `pnpm lint` (Biome; `pnpm format` para formatear)

## 3. Cómo trabaja el agente aquí

### Al arrancar una sesión

1. Ejecutá `./init.sh` y verificá que termina sin errores. Si falla, pará.
2. Leé `docs/tasks.md` para ver las tareas (link a Notion).
3. Conectate a Notion vía MCP, tomá una tarea `pending`, cambiala a `in_progress`.
4. Creá una página de sesión en Notion para documentar el progreso.

### Durante la sesión

- Una sola tarea a la vez.
- Documentá el progreso en Notion mientras trabajás, no al final.
- Antes de implementar, leé `docs/architecture.md` y `docs/conventions.md`.

### Al cerrar la sesión

1. Ejecutá `./init.sh` — todo verde.
2. Marcá la tarea como `done` en Notion.
3. No dejes archivos temporales ni `console.log()` de debug.

## 4. Arquitectura del proyecto

Next.js app con:

- `src/app/` — rutas y páginas (App Router)
- `src/components/` — componentes React (`auth/`, `cotizador/`, `ui/`)
- `src/lib/` — lógica de negocio, validaciones (Zod), auth y generación de PDF
- `src/data/` — datos estáticos
- `docs/` — arquitectura, convenciones, tareas y verificación

## 5. Reglas duras

- **Una tarea a la vez.** No mezcles cambios.
- **No declares una tarea `done` sin `./init.sh` verde.**
- **Documentá el progreso en Notion mientras trabajás.**
- **Si no sabés algo, buscá en `docs/` antes de inventarlo.**
- **No edités código fuera del scope de la tarea actual.**
