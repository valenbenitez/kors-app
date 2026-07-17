# Verificación — Cómo demostrar que el trabajo funciona
> Regla de oro: **el agente no dice "funciona", lo demuestra**.
## Niveles de verificación
### Nivel 1 — Tests (obligatorio)
Toda función pública tiene al menos un test que:
1. Cubre el camino feliz
2. Cubre al menos un camino de error (si puede fallar)

Comando:
bash
npm test

### Nivel 2 — Smoke test manual (recomendado)
Antes de cerrar, verificá con un flujo real:

npm run build    # que compile sin errores
npm run lint     # que no haya errores de lint

### Nivel 3 — Integración (si aplica)

Para APIs: test con supertest (NestJS) o llamada real.
Para frontend: test visual o e2e si existe configurado.

Anti-patrones
❌ "Debería funcionar" → falta test ejecutable
❌ Test que solo verifica que no lanza excepción → tiene que verificar el resultado
❌ Marcar tarea como done sin pasar ./init.sh
❌ Mock innecesario del filesystem

Verificación final
./init.sh

Si ./init.sh está rojo, no marques nada como done. Anotá el bloqueo
en la página de sesión de Notion y poné la tarea como blocked.
