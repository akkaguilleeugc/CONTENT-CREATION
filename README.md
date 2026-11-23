# Creator OS · KROOPY

Sistema operativo personal para un creador de contenido: ideas, producción de vídeos, calendario editorial, tareas, hábitos, objetivos, analítica, identidad de marca y biblioteca de recursos — en una sola aplicación web privada, responsive y con persistencia real.

![stack](https://img.shields.io/badge/React_19-TypeScript-2F5BFF) ![local-first](https://img.shields.io/badge/local--first-IndexedDB-D4F53C)

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/
```

La primera vez aparece una bienvenida: empieza con el espacio vacío o carga **datos de ejemplo** (todos marcados con `demo: true` y eliminables en un clic desde *Ajustes → Data & backup* o desde el banner del Overview).

## Qué incluye

| Sección | Funciones |
|---|---|
| **Overview** | Saludo según la hora, mensaje contextual calculado, 6 indicadores reales, agenda *Today* (tareas completables, grabaciones, ediciones, publicaciones, eventos, hábitos con recordatorio), pipeline por etapas, próximas publicaciones, progreso semanal. |
| **My Ideas** | Captura rápida global (`I`), vistas Grid / Lista / Kanban (drag & drop), búsqueda, filtros (categoría, plataforma, estado, favoritas, archivadas), orden, duplicar, archivar, convertir en proyecto. |
| **Content Studio** | Kanban de 9 etapas con drag & drop que cambia el estado real, vista lista ordenable, y un *workspace* por vídeo: general, concepto, guion (autoguardado, palabras y duración hablada), shot list, checklists de producción y edición configurables, publicación (caption con límite por plataforma, hashtags, portada y miniatura, enlace), archivos vinculados, tareas y estadísticas relacionadas. |
| **Calendar** | Mes / Semana / Día / Agenda, filtros por plataforma y tipo de actividad, arrastrar para reprogramar (fechas y horas), crear desde cualquier día u hora, línea de "ahora", experiencia propia en móvil. |
| **Tasks** | My Day, Upcoming, All Tasks (reordenable por arrastre), Completed; subtareas, recurrencia (diaria, laborables, semanal, mensual), recordatorios, categorías, prioridad, vínculo a vídeos. |
| **Trackers** | Hábitos configurables (diario, laborables, días concretos, X por semana) con racha, % de cumplimiento y mapa de calor de 26 semanas; objetivos diarios → anuales con progreso **automático** (vídeos publicados/producidos, tareas, ideas, check-ins, horas, seguidores) o manual; productividad con temporizador de foco, horas, días productivos. |
| **Analytics** | Registro manual por publicación (views, likes, comentarios, compartidos, guardados, alcance, seguidores), engagement calculado, evolución temporal, por plataforma, mensual, formatos, top posts, comparador de hasta 3 publicaciones, filtros por plataforma/fecha/categoría/formato, comparación con el periodo anterior. |
| **Brand Kit** | Guías (logo, superficies aprobadas, normas do/don't, paleta, degradado, jerarquía tipográfica, lenguaje gráfico), gestor de colores y paletas (copiar HEX/RGB, contraste WCAG), combinaciones, tipografías con previsualización en vivo, moodboard de referencias, assets de marca. |
| **Asset Library** | Subida por arrastre a cualquier parte de la página, carpetas, etiquetas, tipos, grid/lista, previsualización (imagen, vídeo, audio, PDF), descarga, renombrar, vincular a vídeos manteniendo las relaciones. |
| **Global** | Command palette (`⌘/Ctrl K`), creación rápida (`N`), atajos `G + letra`, notificaciones calculadas, recordatorios (toast + notificación del navegador), tema claro/oscuro/sistema, toasts con *deshacer*, confirmaciones, estados vacíos, skeletons, `prefers-reduced-motion`. |

## Identidad visual

- **Colores** (`src/styles/tokens.css`): Ink `#0B0F14`, Navy `#0B1A5C`, Royal `#2F5BFF`, Lime `#D4F53C`, White; secundarios Ice `#EFF8FF`, Neon Lime `#BBEF1F`, Dark `#0D0303`, Hot Pink `#FF0055` (solo acentos: el "punto" rosa de los títulos, la línea de *ahora*).
- **Tipografías**: `public/fonts/Coolvetica-Regular.otf` (titulares, números) y `public/fonts/212-Baby-Girl.otf` (acentos decorativos) cargadas con `@font-face`; Inter (auto-alojada vía `@fontsource-variable/inter`) para la interfaz.
- **Logo**: los archivos originales de `O.zip` están intactos en `public/brand/original/1.png` (logotipo) y `2.png` (símbolo). Para la web se usan copias recortadas al borde transparente y reducidas proporcionalmente (`public/brand/kroopy-logo.png`, `kroopy-symbol.png`) — misma forma, mismo color, mismas proporciones. Como el arte es negro, siempre se presenta sobre placas lima, hielo o blancas.

## Arquitectura

```
src/
  lib/          tipos, constantes, factories, store (zustand), persistencia, métricas, sample data
  components/   UI kit, overlays (modal/sheet, popover, toasts), charts SVG, Kanban, Shell, Command palette
  features/     formularios globales, assets (subida/preview), recordatorios
  pages/        una página por sección (lazy-loaded)
  styles/       tokens + base + ui + layout + pages
supabase/migrations/0001_init.sql   esquema relacional + RLS + bucket privado
landing/ (public/landing)           landing page de marca
motion/                             vídeo de 15 s (fuente HTML + render)
```

### Persistencia

Local-first y real: todos los registros se guardan en **IndexedDB** (con respaldo a `localStorage` si IndexedDB no está disponible) con guardado diferido de 250 ms, flush al ocultar la pestaña y sincronización entre pestañas (`BroadcastChannel`). Los archivos se guardan como blobs en un almacén IndexedDB separado. *Ajustes → Data & backup* exporta/importa una copia JSON completa (registros + archivos).

La UI solo habla con dos interfaces (`DataAdapter` y `FileAdapter` en `src/lib/persistence.ts`). Para pasar a **Supabase**:

1. `supabase db push` con `supabase/migrations/0001_init.sql` (tablas, enums, índices, triggers `updated_at`, RLS por `user_id = auth.uid()` y bucket privado `assets` con carpeta por usuario).
2. Implementar `DataAdapter`/`FileAdapter` con `@supabase/supabase-js` usando solo la *anon key* pública (las claves secretas nunca van al cliente) y Supabase Auth.

### Integraciones de plataformas

No se simula ninguna API. `analytics_records.source` y `content_publications.external_id` ya existen para cuando se configuren las APIs oficiales (TikTok Display API, Instagram Graph API, YouTube Data + Analytics API), que requieren OAuth y un servidor (Supabase Edge Functions) para custodiar los tokens.

## Atajos

`⌘/Ctrl K` paleta · `N` crear · `/` buscar · `I` idea · `V` vídeo · `T` tarea · `E` evento · `U` subir · `G` + `O/I/S/C/T/R/A/B/L` navegar · `Esc` cerrar.
