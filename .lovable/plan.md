

## Plan: Módulos Chatbots/IA, Analytics, Reportes y Dashboards con IA (Híbrido)

### Resumen

Desarrollar los módulos funcionales principales de la plataforma, conectados a datos reales de la tabla `leads`. Se usará una arquitectura híbrida: Edge Functions con OPENAI_API_KEY para respuestas rápidas de IA, y preparación para disparar workflows de n8n para tareas complejas.

---

### Paso 1 — Tablas nuevas en Supabase

Crear migración con las siguientes tablas:

- **`bots`**: Configuración de chatbots por tenant (nombre, tipo: web/whatsapp/telegram, prompt del sistema, modelo, estado activo, canal, configuración JSON, created_at)
- **`bot_conversations`**: Historial de conversaciones (bot_id, tenant_id, user_id, título, created_at)
- **`bot_messages`**: Mensajes individuales (conversation_id, role: user/assistant/system, content, created_at)
- **`dashboard_sessions`**: Sesiones de dashboards IA generados por lenguaje natural (tenant_id, user_id, prompt, resultado JSON, created_at)
- **`exports`**: Registro de exportaciones (tenant_id, user_id, tipo: pdf/xlsx/csv/pptx, módulo origen, archivo_url, created_at)

RLS en todas las tablas con filtro por `tenant_id` usando `get_user_tenant()`.

### Paso 2 — Edge Function: `chat-ai`

Crear `supabase/functions/chat-ai/index.ts`:
- Recibe mensajes + contexto opcional (datos de leads del tenant)
- Usa `OPENAI_API_KEY` existente con streaming SSE
- System prompt en español orientado a análisis de datos de leads
- Soporta modo "analytics" que inyecta resúmenes de datos del tenant como contexto
- Manejo de errores 429/402
- Actualizar `config.toml` con `verify_jwt = false`

### Paso 3 — Edge Function: `analyze-leads`

Crear `supabase/functions/analyze-leads/index.ts`:
- Consulta leads del tenant autenticado
- Genera resúmenes estadísticos (totales por cliente, campaña, BPO, resultados de gestión, etc.)
- Retorna datos agregados para alimentar dashboards y reportes
- No streaming, respuesta JSON directa

### Paso 4 — Módulo Chatbots / AI Agents (`BotsPage.tsx`)

Reemplazar el placeholder con un módulo completo:
- **Lista de bots** del tenant con estado, canal, último uso
- **Crear/editar bot**: formulario con nombre, canal (web/WhatsApp/Telegram), prompt del sistema, modelo
- **Ventana de chat embebida**: interfaz de conversación con streaming usando la Edge Function `chat-ai`
- **Historial de conversaciones** por bot
- Renderizado de markdown en respuestas con `react-markdown`

### Paso 5 — Módulo Dashboards con IA (`DashboardsIAPage.tsx`)

Reemplazar placeholder:
- Input de lenguaje natural: "Muéstrame las conversiones por campaña del último mes"
- Llama a `analyze-leads` para obtener datos + `chat-ai` para interpretar
- Renderiza KPIs, tablas y gráficos generados dinámicamente con Recharts
- Historial de sesiones guardadas
- Opciones: guardar, duplicar, exportar

### Paso 6 — Módulo Analytics Conversacional (`AnalyticsPage.tsx`)

Reemplazar placeholder:
- Dashboard con métricas de leads reales: totales por cliente, campaña MKT, BPO, resultado de gestión, ciudad
- Filtros por fecha, cliente, campaña, BPO
- Gráficos con Recharts (barras, pie, líneas de tendencia)
- Tabla detallada con paginación y búsqueda

### Paso 7 — Módulo Reportes (`ReportesPage.tsx`)

Reemplazar placeholder:
- Generación de reportes basados en datos de leads
- Filtros avanzados (rango de fechas, cliente, campaña, BPO)
- Vista previa del reporte en tabla
- Botón de exportación (conecta con módulo Exportaciones)

### Paso 8 — Módulo Exportaciones (`ExportacionesPage.tsx`)

Reemplazar placeholder:
- Historial de exportaciones del tenant
- Generar exportaciones a CSV y Excel desde datos de leads
- Registro en tabla `exports` con trazabilidad

### Paso 9 — Dashboard Ejecutivo con datos reales (`DashboardPage.tsx`)

Actualizar para usar datos reales de la tabla `leads`:
- KPIs calculados: total leads, leads con negocio, tasa de gestión, distribución por BPO
- Actividad reciente real desde `audit_logs`
- Gráficos de tendencia con Recharts

### Paso 10 — Preparación n8n (híbrido)

- Agregar campo `n8n_workflow_id` opcional en tabla `bots` para asociar workflows
- En la Edge Function `chat-ai`, incluir lógica condicional para disparar webhooks de n8n cuando el bot tenga un workflow asociado
- Documentar la integración para que cuando se creen workflows en n8n, se puedan enlazar fácilmente

---

### Detalles técnicos

**Dependencias nuevas**: `react-markdown`, `recharts` (ya incluido vía shadcn charts)

**Archivos a crear**:
- `supabase/functions/chat-ai/index.ts`
- `supabase/functions/analyze-leads/index.ts`
- Migración SQL con 5 tablas nuevas
- Componentes reutilizables: `ChatWindow.tsx`, `LeadsChart.tsx`, `LeadsTable.tsx`, `ExportButton.tsx`

**Archivos a modificar**:
- `supabase/config.toml` — agregar funciones
- `src/pages/app/BotsPage.tsx` — módulo completo
- `src/pages/app/DashboardsIAPage.tsx` — módulo completo
- `src/pages/app/AnalyticsPage.tsx` — módulo completo
- `src/pages/app/ReportesPage.tsx` — módulo completo
- `src/pages/app/ExportacionesPage.tsx` — módulo completo
- `src/pages/app/DashboardPage.tsx` — datos reales

**Secrets utilizados**: `OPENAI_API_KEY` (ya configurado), `SUPABASE_SERVICE_ROLE_KEY` (ya configurado)

