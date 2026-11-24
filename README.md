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
netlify/functions/                  la nube de KROOPY: api.mts (/api/*) y push-cron.mts (recordatorios)
netlify/server/                     cuentas, almacenamiento (Netlify Blobs), Web Push
supabase/migrations/0001_init.sql   esquema relacional + RLS + bucket privado (alternativa opcional)
landing/ (public/landing)           landing page de marca
motion/                             vídeo de 15 s y vídeo de lanzamiento de 80 s (fuente HTML + render)
```

### Persistencia

Local-first y real: todos los registros se guardan en **IndexedDB** (con respaldo a `localStorage` si IndexedDB no está disponible) con guardado diferido de 250 ms, flush al ocultar la pestaña y sincronización entre pestañas (`BroadcastChannel`). Los archivos se guardan como blobs en un almacén IndexedDB separado. *Ajustes → Data & backup* exporta/importa una copia JSON completa (registros + archivos).

La UI solo habla con dos interfaces (`DataAdapter` y `FileAdapter` en `src/lib/persistence.ts`). Con una cuenta, `src/lib/sync.ts` mantiene esa copia local sincronizada con la nube de KROOPY (ver *Cuenta y sincronización entre dispositivos*). `supabase/migrations/` describe además un esquema relacional con RLS para quien prefiera Supabase.

### Integraciones de plataformas

No se simula ninguna API. `analytics_records.source` y `content_publications.external_id` ya existen para cuando se configuren las APIs oficiales (TikTok Display API, Instagram Graph API, YouTube Data + Analytics API), que requieren OAuth y un servidor (Supabase Edge Functions) para custodiar los tokens.

## Cuenta y sincronización entre dispositivos

KROOPY sigue siendo *local-first* (funciona sin cuenta y sin conexión), pero con una cuenta (correo + contraseña) el portátil, el móvil y la tablet comparten los mismos datos: marcas un objetivo o una tarea en el móvil y en 1–4 segundos aparece en el ordenador, sin recargar. Si un dispositivo estaba sin conexión, sus cambios esperan en una cola y se envían al reconectar.

**No hay nada que configurar.** La nube es de KROOPY y se despliega con la propia app (mismo sitio de Netlify): sin claves, sin cuentas de terceros, sin variables de entorno.

- **Servidor:** `netlify/functions/api.mts` (`/api/*`) + `netlify/server/` — cuentas (contraseñas con *scrypt*, tokens firmados con HMAC, bloqueo tras 10 intentos fallidos), sincronización, archivos (en partes de 4 MB, cualquier tamaño) y notificaciones. Datos en **Netlify Blobs**, que se crean solos: `kroopy-users`, `kroopy-data` (todo lo de una cuenta, JSON comprimido), `kroopy-files`, `kroopy-push`, `kroopy-config` (clave de firma y claves VAPID, generadas la primera vez). Cada escritura es condicional (ETag) y se reintenta si otro dispositivo escribió a la vez: nunca se pisan cambios.
- **Motor en la app:** `src/lib/sync.ts` + `src/lib/cloud/netlify.ts` — detecta cada alta, cambio o borrado local, lo guarda en una cola persistente y lo sube; descarga lo nuevo desde la última vez (ordenado por el reloj del servidor). Sin canal en directo, consulta cada 3 s mientras usas la app, cada 8 s si está abierta delante de ti, cada 45 s en segundo plano, nunca con la pestaña oculta, y al instante cuando vuelves a ella. Gana la última escritura; los borrados viajan como «lápidas».
- **Contraseña olvidada:** la nube no envía emails, así que al crear la cuenta se muestra una **clave de recuperación** (`XXXXX-XXXXX-XXXXX-XXXXX`, copiar/descargar). Con email + clave se pone una contraseña nueva; desde un dispositivo con la sesión iniciada también se puede cambiar la contraseña o generar otra clave (*Cuenta → Contraseña y clave de recuperación*). Cambiar la contraseña cierra la sesión en los demás dispositivos.
- **Pantalla:** `/account` (iniciar sesión, crear cuenta, recuperar contraseña, estado, sincronizar ahora, cerrar sesión y **eliminar cuenta**, que borra cuenta, datos y archivos de la nube).
- **Alternativa:** si defines `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example` y `supabase/migrations/0003_sync.sql`), la app usa Supabase en su lugar.

### Notificaciones en el móvil

Los recordatorios de tareas, eventos, hábitos y publicaciones programadas llegan al móvil (y al ordenador) **aunque KROOPY esté cerrado**, con Web Push estándar:

1. *Ajustes → Notificaciones → Notificaciones push en este dispositivo* (con la sesión iniciada). En **iPhone/iPad** primero hay que añadir KROOPY a la pantalla de inicio (Safari → Compartir → Añadir a pantalla de inicio, iOS 16.4 o posterior) y activarlo desde el icono.
2. Cada dispositivo con sesión mantiene en la nube la lista de recordatorios de los próximos 14 días (`src/lib/push.ts`, mismo planificador que los avisos dentro de la app: `src/features/reminders.ts`).
3. `netlify/functions/push-cron.mts` se ejecuta cada 2 minutos y envía lo que toca (cifrado, firmado con VAPID). Cada recordatorio se envía una sola vez y lleva la misma etiqueta que el aviso dentro de la app, así que nunca sale duplicado.
4. *Enviar prueba* comprueba todo el camino.

**Desarrollo local de la nube:** `netlify dev` (sirve la app y las funciones; los Blobs son locales) o, para recarga en caliente, `netlify dev` en el puerto 8888 y `KROOPY_API_PROXY=http://localhost:8888 npm run dev`.

**Pruebas realizadas:** 35 comprobaciones de la API (alta, login, contraseña incorrecta, sincronización, borrados, paginación, 20 escrituras simultáneas desde dos dispositivos sin perder ninguna, archivo de 5 MB en partes, clave de recuperación, cierre de sesión en otros dispositivos, bloqueo por intentos, borrado de cuenta); 18 con tres navegadores (portátil, iPhone, tablet: tarea completada en el móvil → portátil en ~3,5 s, objetivo en ~1,7 s, cambios sin conexión, borrados, recuperación con la clave); 14 de notificaciones (activar en el móvil, prueba, recordatorio creado en el portátil entregado al móvil por el envío programado, cifrado aes128gcm + VAPID, sin duplicados, el service worker lo muestra, desactivar).

## Kroo, la mascota (y cara de KROOPY AI)

Personaje original (`src/assets/kroo.avatar.json`) dibujado con [`@bible-strong/avatar-react`](https://www.npmjs.com/package/@bible-strong/avatar-react) (MIT): `src/components/Mascot.tsx` (carga diferida del motor en `MascotRenderer.tsx`). Está en la bienvenida y en el Overview; sigue al puntero, rebota al tocarlo y se queda quieto con «reducir movimiento». Estados del catálogo listos para el chat: `thinking`, `streaming`, `writing`, `celebrate`, `failed`…

## KROOPY AI

Chat en `/ai` (menú lateral y Kroo en el Overview): respuestas en streaming, detener, copiar, regenerar, historial por cuenta (sincronizado entre dispositivos), «Pensar a fondo», y botones *Guardar como idea* / *Crear tarea*. Conoce tus ideas, vídeos en producción, calendario, tareas, objetivos y estadísticas (resumen leído en el servidor, solo de tu cuenta; los datos de ejemplo se excluyen).

- **Servidor:** `netlify/functions/ai.mts` (`/api/ai/*`) con [AI SDK](https://ai-sdk.dev) `streamText` + `@ai-sdk/openai`. Capa de modelos en `netlify/server/ai/models.ts` (rol → modelo: *chat* = GPT‑6 Terra, *deep* = GPT‑6 Sol; elige la versión más nueva disponible para la clave). Historial y consumo en `netlify/server/ai/history.ts`; contexto del espacio de trabajo en `workspace.ts`.
- **Clave:** `OPENAI_API_KEY` en las variables de entorno de Netlify (ámbito *Functions*). Sin clave, la página lo explica en vez de fallar.
- **Gasto:** límites por cuenta (por defecto 0,50 $/día y 6 $/mes, estimados) + el límite duro del proyecto en OpenAI.
- **Pruebas sin clave:** `KROOPY_AI_MOCK=1 netlify dev` usa un modelo falso (solo en local; nunca en un sitio desplegado).
- **Vistas previas aisladas:** los despliegues de rama usan almacenes `*-preview`, separados de las cuentas reales de kroopy.es.

Auditoría, decisiones y etapas: [`docs/KROOPY_AI_PLAN.md`](docs/KROOPY_AI_PLAN.md).

## Idiomas

Inglés, español y portugués de Brasil, con selector en Ajustes → Idioma, en la barra lateral (botón EN/ES/PT), en el menú *Más* del móvil y en la pantalla de bienvenida. Fechas en el idioma elegido (date-fns). Cómo añadir textos: `scripts/i18n/README.md`.

## Privacidad, cookies y App Store

- Páginas públicas en los tres idiomas: `/privacy`, `/terms`, `/cookies`, `/support` (enlazadas desde Ajustes → Privacidad y aspectos legales, la cuenta, la bienvenida y el menú *Más*).
- Solo almacenamiento estrictamente necesario (sin cookies de publicidad ni analítica), con un aviso informativo la primera vez.
- **Antes de publicar:** pon tus datos reales en `src/lib/legal.ts` (titular, correo de contacto, país).
- Guía paso a paso para la App Store (Capacitor, ficha, etiqueta de privacidad, notas para revisión): `docs/APP_STORE.md`.

## Animaciones e interacción

- Fondo que reacciona al ratón o al dedo (`src/components/PointerFX.tsx`, capas en GPU, sin repintar degradados).
- Cursor propio: punto inmediato + anillo con retraso (lerp 0,14) que crece sobre elementos interactivos y reacciona al clic; solo con ratón/trackpad y nunca en campos de texto.
- Microcelebraciones al completar un logro (tarea, hábito, checklist, vídeo publicado, objetivo, idea convertida): `src/lib/celebrate.ts`. Nunca se disparan por cambios que llegan de la sincronización.
- Entrada escalonada de cada página. Todo respeta `prefers-reduced-motion`.

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
