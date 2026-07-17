# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define el estándar de calidad. Los agentes revisores evalúan
> el código contra este archivo. Si no está aquí, no es un requisito.

## Principios

1.**Capas claras.** _Describí las capas de tu proyecto._
   Frontend ejemplo: `app/` (rutas) → `components/` (UI) → `services/` (API) → `models/` (tipos)
   Backend ejemplo: `src/modules/` (dominios Nest) → `src/providers/` (adaptadores externos)

2.**Sin dependencias de mas.** Cada dependencia externa está justificada.
   Si una tarea requiere una nueva, se discute antes.

3.**Errores explícitos.** Las funciones que pueden fallar lanzan excepciones
   nombradas. No valores `null`/`undefined` silenciosos.

4.**Tipado estricto.** `strict: true` en `tsconfig.json`. Evitar `any` y `as` casts
   innecesarios.

## Flujo de datos

_Dibujá el flujo principal de tu aplicación._

Frontend:
usuario → app/page.tsx → components/ → services/api.ts → backend

Backend:
controller → service → provider (Firebase/Circle/etc.)

## Qué NO hacer

- No usar `console.log()` para debug — usar el logger del proyecto
- No mezclar lógica de negocio con HTTP (controllers delgados, services gordos)
- No mutar props ni estado global sin side-effects explícitos