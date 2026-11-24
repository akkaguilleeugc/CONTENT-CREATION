# KROOPY

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
| **Brand Kit** | **Tu marca, no la de la app**: empieza vacío y se construye con lo que subes. Asistente de 4 pasos (nombre e historia, logo, colores, tipografías), logo principal + símbolo + variantes (vista previa sobre tus colores), gestor de paletas y colores (copiar HEX/RGB, contraste WCAG), combinaciones, **tipografías propias** (subes .otf/.ttf/.woff/.woff2 y se renderizan de verdad con la API FontFace, o usas una instalada), jerarquía tipográfica, reglas *do / don't* editables, moodboard de referencias y assets de marca. |
| **Asset Library** | Subida por arrastre a cualquier parte de la página, carpetas, etiquetas, tipos, grid/lista, previsualización (imagen, vídeo, audio, PDF), descarga, renombrar, vincular a vídeos manteniendo las relaciones. |
| **Global** | Command palette (`⌘/Ctrl K`), creación rápida (`N`), atajos `G + letra`, notificaciones calculadas, recordatorios (toast + notificación del navegador), tema claro/oscuro/sistema, toasts con *deshacer*, confirmaciones, estados vacíos, skeletons, `prefers-reduced-motion`. |

## Identidad visual de la app

La interfaz de Creator OS usa la identidad KROOPY (la marca de la herramienta). **El Brand Kit y la Asset Library son solo para tu marca**: no traen nada precargado. Si vienes de la versión anterior, la migración v2 elimina automáticamente los colores, combinaciones y logos KROOPY que se habían sembrado ahí y conserva todo lo que añadiste tú.

- **Colores de la app** (`src/styles/tokens.css`): Ink `#0B0F14`, Navy `#0B1A5C`, Royal `#2F5BFF`, Lime `#D4F53C`, White; secundarios Ice `#EFF8FF`, Neon Lime `#BBEF1F`, Dark `#0D0303`, Hot Pink `#FF0055`.
- **Tipografías de la app**: Coolvetica (titulares) y 212 Baby Girl (acentos) en `public/fonts/`; Inter para la interfaz.
- **Logo de la app**: originales intactos en `public/brand/original/`; copias web recortadas en `public/brand/`.

## App en el móvil (Añadir a pantalla de inicio)

KROOPY es una PWA instalable. En iPhone: **Safari → Compartir → Añadir a pantalla de inicio**; en Android/escritorio: botón **Instalar** (también en *Ajustes → App*).

- **Nombre e icono**: aparece como **KROOPY** con el símbolo **OO** sobre la placa lima (`public/icons/`, generados desde `public/brand/original/2.png` sin alterarlo) y pantallas de arranque de marca para cada iPhone/iPad (`public/splash/`).
- **Offline**: un service worker (generado en el build por `pwa/sw-plugin.ts`) precachea toda la app; abre al instante y funciona sin conexión. Las nuevas versiones se instalan en segundo plano y aparece un aviso **Actualizar**.
- **Atajos** (mantener pulsado el icono): Nueva idea, Nuevo vídeo, Nueva tarea, Calendario.
- **Compartir a KROOPY** (Android): comparte un TikTok, reel o enlace desde cualquier app y llega como idea nueva.
- **Badge** en el icono con las tareas de hoy y vencidas; recordatorios como notificaciones del sistema (en iPhone, tras instalar la app y permitir notificaciones).
- **Comodidad móvil**: campos a 16 px (sin zoom al escribir), hojas inferiores que se cierran deslizando hacia abajo, barra inferior que se aparta con el teclado, áreas seguras (notch / Dynamic Island), vibración háptica al completar (Android).

Regenerar iconos, pantallas de arranque y capturas: `node scripts/generate-pwa-assets.cjs --screenshots` (con `npm run dev` en marcha).

**Despliegue**: `netlify.toml` y `vercel.json` ya configuran build (`npm run build` → `dist`), cabeceras del service worker/manifest y la SPA. Si ya añadiste una versión anterior a tu pantalla de inicio, bórrala y vuelve a añadirla: iOS guarda el nombre y el icono del momento en que la añadiste.

## Liquid glass — [`liquid-glass-react`](https://github.com/rdev/liquid-glass-react)

Instalado desde npm (`liquid-glass-react@1.1.1`, el mismo código que el repositorio; el repo no incluye `dist/`, así que la versión publicada es la que trae el build) y aplicado con un envoltorio propio, `src/components/Glass.tsx` (`GlassSurface`), en las superficies flotantes:

- diálogos y hojas inferiores, menús y popovers, toasts, paleta de comandos;
- barras flotantes superior e inferior en móvil (estilo iOS);
- tarjetas arrastradas en el Kanban y chips del calendario (lente sobre el contenido).

Detalles de integración:
- El vidrio de la librería (mapa de desplazamiento SVG + aberración cromática + blur/saturación) se monta **detrás** del contenido real, que sigue en flujo normal, y se dimensiona con un `ResizeObserver`.
- Sus capas de borde usan `mix-blend-mode`, que aísla el contexto de apilamiento y deja el `backdrop-filter` sin nada que refractar; se ocultan y el borde especular se redibuja con mezcla normal y sigue al puntero.
- Sin elasticidad (el contenido no se desplaza), animaciones de entrada solo con `transform` (una opacidad < 1 en un ancestro anula la refracción) y tinte de marca para legibilidad en tema claro y oscuro.
- *Ajustes → Apariencia → Liquid glass* lo desactiva (vuelve a vidrio esmerilado CSS). Efecto completo en navegadores Chromium; Safari y Firefox muestran solo el esmerilado (limitación de la librería).

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
motion/                             vídeo de 15 s y vídeo de lanzamiento de 80 s (fuente HTML + render)
```

### Persistencia

Local-first y real: todos los registros se guardan en **IndexedDB** (con respaldo a `localStorage` si IndexedDB no está disponible) con guardado diferido de 250 ms, flush al ocultar la pestaña y sincronización entre pestañas (`BroadcastChannel`). Los archivos se guardan como blobs en un almacén IndexedDB separado. *Ajustes → Data & backup* exporta/importa una copia JSON completa (registros + archivos).

La UI solo habla con dos interfaces (`DataAdapter` y `FileAdapter` en `src/lib/persistence.ts`). Para pasar a **Supabase**:

1. `supabase db push` con `supabase/migrations/` — `0001_init.sql` (tablas, enums, índices, triggers `updated_at`, RLS por `user_id = auth.uid()` y bucket privado `assets` con carpeta por usuario) y `0002_brand_kit.sql` (perfil de tu marca y tipografías propias).
2. Implementar `DataAdapter`/`FileAdapter` con `@supabase/supabase-js` usando solo la *anon key* pública (las claves secretas nunca van al cliente) y Supabase Auth.

### Integraciones de plataformas

No se simula ninguna API. `analytics_records.source` y `content_publications.external_id` ya existen para cuando se configuren las APIs oficiales (TikTok Display API, Instagram Graph API, YouTube Data + Analytics API), que requieren OAuth y un servidor (Supabase Edge Functions) para custodiar los tokens.

## Landing page — `/landing/`

`public/landing/index.html` reproduce la especificación de la landing de una sola pantalla (tokens, breakpoints desde 390 px hasta 2560 px, bloqueo de scroll en escritorio, menú móvil a pantalla completa, coreografía de entrada con *fallback* JS y `prefers-reduced-motion`) adaptada a la identidad KROOPY:

- Fondo Ink, CTA sólido Lime, *glows* Royal, el punto Hot Pink en el titular.
- H1 en Coolvetica, palabras de acento en 212 Baby Girl (sustituye a Instrument Serif), interfaz en Inter auto-alojada (`inter.woff2`).
- Logo KROOPY original sobre placa lima; favicon con el símbolo.
- Vídeo de fondo del hero: la URL de CloudFront indicada, al 100 % de opacidad y sin overlay (con un degradado de marca como respaldo mientras carga).
- Producto: **ViralGrow by KROOPY**. Las cifras del pie describen el producto real (pipeline de 9 etapas, etc.) en lugar de estadísticas inventadas.

En desarrollo: `npm run dev` → http://localhost:5173/landing/

## Vídeo de 15 s — `motion/`

| Archivo | Qué es |
|---|---|
| `motion/out/viralgrow-15s.mp4` | Render final 1920×1080 · 60 fps · H.264 + AAC (−14 LUFS) |
| `motion/viralgrow-15s.html` | Composición: línea de tiempo determinista `render(t)`; ábrela en el navegador para verla en bucle |
| `motion/soundtrack.py` | Banda sonora sintetizada (120 BPM), sincronizada con cada corte |
| `motion/render.cjs` | Renderiza fotograma a fotograma con Playwright y codifica con ffmpeg |

```bash
python3 motion/soundtrack.py motion/out/soundtrack.wav
node motion/render.cjs
```

Guion: 0–2 s palabras cinéticas (Ideas · Scripts · Shoots · Stats) → 2–4 s del caos al sistema (las 9 etapas encajan sobre el degradado de marca) → 4–7 s el producto en 3D (KPIs, tarjeta que avanza por el pipeline, anillo de progreso) → 7–10 s seis cortes a ritmo (Plan · Script · Shoot · Track · Measure · Grow) → 10–12,5 s *drop*: curva de crecimiento exponencial con partículas → 12,5–15 s cierre con la landing y el sello del logo.

## Vídeo de lanzamiento de 80 s — `motion/kroopy-launch/`

1080×1920 · 60 fps · 120 BPM (160 tiempos). La interfaz real de KROOPY reconstruida como capas vectoriales (con los iconos Lucide de la app y los datos de ejemplo reales), conducida por un cursor con clics y arrastres reales y una cámara tipo *screen studio*. El objeto conductor es el botón lima **+ (Crear)**: idea → cursor de texto → botón *Capture idea* → tarjeta → punto final → *Convert to content* → tarjeta del Kanban → etapa actual → *Published* → evento del calendario → casilla de tarea → hábito de hoy → *Start focus* → + de la barra → logo OO.

| Archivo | Qué es |
|---|---|
| `motion/out/kroopy-launch-80s.mp4` | Render final (H.264 + AAC, −14 LUFS) |
| `motion/kroopy-launch/src.html` | Composición: todo se calcula a partir del tiempo dentro de `window.seek(t)` (muelles y easing exponencial como funciones del tiempo, desenfoque direccional según la velocidad) + banda sonora con Web Audio (`OfflineAudioContext`) |
| `motion/kroopy-launch/kroopy-launch.html` | El mismo archivo con fuente, logo e iconos incrustados (`?t=12.5` muestra un instante, `?play` lo reproduce) |
| `motion/kroopy-launch/render.cjs` | Audio → WAV, fotogramas por tiempo para revisión, y render a 60 fps con 3 subfotogramas por fotograma mezclados con `tmix` |

```bash
cd motion/kroopy-launch
node build.cjs              # src.html → kroopy-launch.html
node render.cjs audio       # ../out/kroopy-soundtrack.wav
node render.cjs beats       # un fotograma por tiempo, para revisar
node render.cjs video 4     # 4 procesos en paralelo → ../out/kroopy-launch-80s.mp4
```

## Lanzamiento «KROOPY en tu portátil y tu iPhone» (45 s) — `motion/kroopy-devices/`

1080×1920 · 60 fps · 128 BPM (96 tiempos). Anuncia la app instalable: en el portátil (icono de instalar en la barra de direcciones → ventana propia, paleta `Ctrl K`, tablero, calendario, accesos directos del manifiesto en el dock) y en el iPhone (Compartir → Añadir a pantalla de inicio → icono propio, *splash*, pantalla completa, funciona sin conexión, insignia con las tareas pendientes). El objeto conductor es el propio icono lima de KROOPY. Paleta completa de marca (Ink, Lime, Royal, Hot Pink, Navy) y las tres fuentes de la app: Coolvetica, 212 Baby Girl e Inter. No se muestra sincronización entre dispositivos porque la app todavía no la tiene.

| Archivo | Qué es |
|---|---|
| `motion/out/kroopy-devices-45s.mp4` | Render final (H.264 + AAC, −14 LUFS) |
| `motion/kroopy-devices/src.html` | Composición `window.seek(t)` + banda sonora con Web Audio |
| `motion/kroopy-devices/render.cjs` | Audio, fotogramas por tiempo y render a 60 fps con 3 subfotogramas (`tmix`) |

```bash
cd motion/kroopy-devices && node build.cjs && node render.cjs audio && node render.cjs video 4
```

## Atajos

`⌘/Ctrl K` paleta · `N` crear · `/` buscar · `I` idea · `V` vídeo · `T` tarea · `E` evento · `U` subir · `G` + `O/I/S/C/T/R/A/B/L` navegar · `Esc` cerrar.
