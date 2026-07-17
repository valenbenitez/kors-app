# Tareas y progreso
Este repo usa **Notion** para gestionar tareas y registrar el progreso de sesión.
## Base de tareas
Cada tarea está en la base de Notion con su estado (`pending` / `in_progress` / `done` / `blocked`),
criterios de aceptación y repo asociado.
🔗 **[Abrir base de tareas en Notion](https://app.notion.com/p/39f8f690ec12808aa5e6ef4d757ee616?v=39f8f690ec1280d4b3d7000c3e39ee50)**
> Si estás en Cursor con MCP de Notion configurado, podés consultar esta base
> usando el MCP tool. Pedí "mostrame las tareas pendientes" o "cambiá la tarea
> #7 a in_progress".
## Sesión activa
El progreso se documenta **dentro de la misma tarea en la base de Notion**. NO se crean tareas nuevas.
## Instrucciones para el agente
1. Al arrancar: abrí la base de tareas, encontrá una `pending`, cambiala a `in_progress`
2. Documentá el plan, la fecha de inicio y la bitácora en esa misma tarea (en propiedades o contenido de la fila)
3. Durante la implementación: actualizá el progreso en esa misma tarea
4. Al cerrar: marcá la tarea como `done` o `blocked` y completá el resumen en esa misma tarea