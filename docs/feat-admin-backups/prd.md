# PRD — Gestión de backups de Firestore desde /admin

**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**Fecha:** 2026-03-11

---

## Objetivo

Permitir al administrador crear, listar y restaurar backups de la base de datos Firestore directamente desde el panel de administración, sin necesidad de acceder a la consola de Firebase o ejecutar comandos CLI.

---

## Contexto

Actualmente no existe ningún mecanismo de backup para la base de datos. Si se corrompen datos o se ejecuta un seed accidental en producción, no hay forma de revertir. La gestión de backups requiere acceso directo a `gcloud` o la consola de Firebase, lo cual no es práctico.

---

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-1 | Crear backup manual de toda la base de datos desde la UI | Alta |
| RF-2 | Listar backups existentes con fecha, estado y metadata | Alta |
| RF-3 | Restaurar la base de datos desde un backup seleccionado | Alta |
| RF-4 | Confirmación explícita antes de restaurar (acción destructiva) | Alta |
| RF-5 | Mostrar estado en tiempo real de operaciones (progreso/completado/error) | Media |
| RF-6 | Eliminar backups antiguos desde la UI | Baja |

---

## Requisitos no funcionales

- Solo accesible para el admin (`benoffi11@gmail.com`)
- Las operaciones de backup/restore se ejecutan en Cloud Functions (no desde el cliente)
- Compatible con el plan Blaze de Firebase
- No debe afectar el rendimiento de la app mientras se ejecuta un backup
- Timeout máximo de 5 minutos por operación

---

## Arquitectura propuesta

```text
Frontend (AdminLayout)          Cloud Functions              Google Cloud
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ BackupsPanel     │────▶│ createBackup()      │────▶│ Firestore Export │
│ - Crear backup   │     │ listBackups()       │     │ → GCS Bucket     │
│ - Listar backups │◀────│ restoreBackup()     │     │                  │
│ - Restaurar      │     │ deleteBackup()      │────▶│ Firestore Import │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Flujo:**

1. Admin hace clic en "Crear backup" en la UI
2. Frontend llama a Cloud Function `createBackup` (callable)
3. Cloud Function ejecuta `exportDocuments` via Admin SDK → exporta a Cloud Storage bucket
4. Frontend muestra estado del backup
5. Para restaurar: Cloud Function ejecuta `importDocuments` desde el bucket

---

## UX

### Nueva pestaña "Backups" en AdminLayout

- **Botón "Crear backup"** — con ícono de backup, disabled mientras hay operación en curso
- **Tabla de backups** — columnas: Fecha, Estado (completado/en progreso/error), Acciones (restaurar, eliminar)
- **Diálogo de confirmación para restaurar** — texto explícito: "Esta acción sobrescribirá los datos actuales. ¿Estás seguro?"
- **Snackbar/Alert** con resultado de cada operación

---

## Fuera de alcance (v1)

- Backups automáticos programados (cron)
- Backup selectivo por colección
- Comparación entre backup y estado actual
- Descarga local del backup

---

## Dependencias

- Plan Blaze de Firebase (requerido para Cloud Storage + export/import)
- Cloud Storage bucket para almacenar exports
- Permisos de service account para `datastore.databases.export` / `datastore.databases.import`
