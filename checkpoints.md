# CHECKPOINTS — Evaluación del estado final
> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
## C1 — El harness está completo
- [ ] Existen: `AGENTS.md`, `init.sh`, `CHECKPOINTS.md`, `docs/TASKS.md`
- [ ] Existen los 3 docs: `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`
- [ ] `./init.sh` termina con exit code 0
## C2 — El estado es coherente
- [ ] Como mucho una tarea en `in_progress` en la base de Notion
- [ ] Toda tarea `done` tiene tests asociados que pasan
- [ ] La página de sesión activa en Notion refleja el estado actual
## C3 — El código es limpio
- [ ] No hay `console.log()` de debug (excepto en tests)
- [ ] No hay archivos temporales sin trackear (`*.tmp`, `dist/`, etc.)
- [ ] No hay TODOs sin contexto ni comentarios de código muerto
## C4 — La verificación es real
- [ ] `npm test` pasa y muestra > 0 tests
- [ ] Los tests usan datos reales (no mocks innecesarios)
- [ ] El lint no tiene errores
## C5 — La sesión se cerró bien
- [ ] No hay archivos sin trackear sospechosos
- [ ] La página de sesión en Notion tiene el resumen final
- [ ] La tarea trabajada está reflejada en su estado correcto en Notion