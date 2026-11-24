# KROOPY — Auditoría y plan de evolución (Creator OS + KROOPY AI)

*Fecha: 24 de noviembre de 2026. Precios y modelos comprobados ese día en las páginas oficiales; se vuelven a
comprobar antes de configurar cada uno.*

---

## 1. Auditoría: lo que existe hoy

### La app
| Pieza | Estado real |
|---|---|
| Frontend | React 19 + TypeScript 5.9 + Vite 6, SPA con rutas, `npm`. Diseño propio (tokens, Coolvetica, lima `#D4F53C`, azul `#2F5BFF`). |
| Datos | *Local-first*: todo en IndexedDB del dispositivo; funciona sin conexión (PWA instalable, iPhone incluido). |
| Módulos | Overview, Ideas, Studio (vídeos con guion, planos, checklist), Calendario, Tareas, Hábitos y Objetivos, Analítica (introducida a mano), Brand Kit, Biblioteca de recursos, Ajustes. |
| Idiomas | Inglés, español y portugués de Brasil. |
| Legal | Privacidad, términos, cookies y soporte en 3 idiomas (faltan tus datos reales en `src/lib/legal.ts`). |
| Mascota | **Kroo** (nuevo): personaje original con `@bible-strong/avatar-react` (MIT). |

### El backend (ya en producción en kroopy.es)
| Pieza | Estado real |
|---|---|
| Servidor | **Netlify Functions**: `netlify/functions/api.mts` (`/api/*`) y `push-cron.mts` (cada 2 min). Desplegado en el último deploy de producción (commit `052cc8f`). |
| Base de datos | **Netlify Blobs** (incluido en Netlify, sin configurar nada): usuarios, datos sincronizados por usuario, archivos, notificaciones. |
| Cuentas | Email + contraseña propios (scrypt, tokens firmados, bloqueo por intentos, clave de recuperación). Cada petición se comprueba contra su usuario: **ya es multiusuario**. |
| Sincronización | Ordenador ↔ móvil ↔ tablet en 1–4 s. |
| Notificaciones | Web Push (también iPhone instalado en pantalla de inicio). |
| Supabase | El cliente está instalado y hay migraciones, pero **no se usa** (alternativa opcional). |
| Redes sociales | Ninguna conexión real todavía: la analítica se introduce a mano. |

### Hosting y costes (importante)
- Equipo de Netlify **RUMBO**, plan **Free** (de créditos): **300 créditos/mes, límite duro**. Si se agotan,
  **se pausan todos tus sitios** (kroopy.es y rumbofit) hasta el mes siguiente; no se pueden comprar más en Free.
- Tarifas: cómputo 10 créditos/GB-hora · ancho de banda 20 créditos/GB · 2 créditos por 10 000 peticiones ·
  **15 créditos por cada despliegue a producción** · las vistas previas de rama son gratis.
- **kroopy.es se publica desde la rama en la que trabajo**: cada `push` = un despliegue a producción = 15 créditos.
  → A partir de ahora **no subo nada sin tu OK**, y propongo (paso 0) separar «producción» de «pruebas».
- Consumo estimado de lo ya construido para uso personal: ~40 créditos/mes (peticiones de sincronización +
  envío de notificaciones). Compruébalo en Netlify → *Team → Usage*.

---

## 2. Decisiones de arquitectura (y por qué)

### 2.1 Mantener Netlify + Blobs (no añadir Supabase todavía)
La app ya tiene usuarios, autorización por usuario y almacenamiento funcionando en Netlify, gratis.
Añadir Supabase ahora duplicaría las cuentas, obligaría a migrar datos y a crear otra cuenta externa.
- Conversaciones, memoria, tokens de redes y métricas históricas se guardan en Blobs, **separados por usuario**
  (la clave de cada dato empieza por el id del usuario y el id sale del token firmado, nunca del navegador).
- **Cuándo pasar a PostgreSQL + pgvector** (Supabase o Netlify Database): cuando KROOPY tenga muchos usuarios
  o necesitemos consultas complejas sobre millones de métricas. La capa de datos del servidor queda aislada en
  un módulo para que esa migración no toque el chat ni la interfaz.

### 2.2 KROOPY AI con Vercel AI SDK (conexión directa, sin intermediarios de pago)
Versiones comprobadas en npm: `ai` 7.0.181 · `@ai-sdk/react` 4.0.186 (compatible con React 19) ·
`@ai-sdk/google` 4.0.126 · `@ai-sdk/openai` 4.0.123 · `@ai-sdk/anthropic` 4.0.108 · `zod` 4.6.7. Licencias Apache-2.0 / MIT.

- **Servidor** (`netlify/functions/ai.mts`): `streamText` con respuesta en *streaming* (límite de Netlify: 60 s por
  respuesta, de sobra para un chat), herramientas con `tool` + `zod`, y **aprobación humana** de las herramientas
  que crean o cambian datos (`toolApproval`; en el cliente `addToolApprovalResponse`).
- **Cliente**: `useChat` de `@ai-sdk/react` (streaming, detener, regenerar, historial).
- **No se activa Vercel AI Gateway** (intermediario de pago).
- **Capa de modelos** (`netlify/server/ai/models.ts`): el chat pide «rápido» o «potente» y la capa decide el modelo;
  cambiar de proveedor = cambiar una línea de configuración.

### 2.3 Proveedor inicial: Google Gemini (mejor calidad/precio)
| Uso | Modelo (estable) | Precio por 1M tokens (entrada / salida) |
|---|---|---|
| Rápido (captions, ideas, la mayoría de mensajes) | `gemini-3.5-flash-lite` | $0.30 / $2.50 |
| Potente (estrategia, análisis de estadísticas, guiones largos) | `gemini-3.8-flash` | $0.75 / $3.75 hasta el 31-12-2026; $1.50 / $7.50 desde 2027 |
| Memoria semántica (más adelante) | `gemini-embedding-001` (768 dimensiones) | se comprobará al activarla |

**Coste estimado** (mensaje típico ≈ 4 000 tokens de contexto + 600 de respuesta):
≈ 0,003 $ con Flash-Lite y ≈ 0,005 $ con Flash. **30 mensajes al día ≈ 2–5 €/mes.**

**Por qué la versión de pago de Gemini y no la gratuita:** según los términos de la API de Gemini, en la versión gratuita
Google puede usar tus conversaciones para mejorar sus productos (con revisión humana), y las apps que se
ofrecen a usuarios del Espacio Económico Europeo deben usar los servicios de pago. Con la de pago Google no
entrena con tus datos.

**Control de gasto (doble):**
1. En Google AI Studio: **tope de gasto mensual del proyecto** (por ejemplo 8 €). Al llegar, la IA se detiene; la web sigue funcionando.
2. En KROOPY: cuota diaria por usuario, límite de tokens por respuesta y registro de coste de cada mensaje.

**Alternativa sin claves: Netlify AI Gateway** (ya incluido en tu plan): no requiere crear cuentas ni claves, pero
cobra los mismos precios **de tus 300 créditos** (= 1,67 $ al mes en total, compartidos con el hosting). Agotarlos
**pausaría kroopy.es y rumbofit**. Solo lo recomiendo para una prueba corta o si pasas al plan Personal (9 $/mes).

OpenAI y Claude quedan preparados en la misma capa (paquetes oficiales del AI SDK) para cuando quieras
usarlos en tareas concretas. *Claude Pro no incluye saldo de API.*

### 2.4 Memoria y contexto
1. **Lo que ya sabe KROOPY**: el servidor de la IA puede leer los datos sincronizados del propio usuario
   (ideas, guiones, proyectos, calendario, tareas, objetivos, estadísticas). Herramientas de **solo lectura**
   (`buscar_ideas`, `ver_calendario`, `ver_estadisticas`…) traen únicamente lo necesario para cada pregunta.
2. **Memoria persistente**: hechos y decisiones («este mes potenciamos los vlogs de jornada») guardados por
   usuario, con búsqueda por palabras + recencia; ver, editar, exportar y borrar desde la app.
3. **Búsqueda semántica** (encontrar «aquella idea de los vlogs de mi jornada» aunque se dijera distinto):
   embeddings de Gemini guardados junto a cada memoria/idea y comparados en el servidor. Se activa cuando haya
   volumen que lo justifique (coste de céntimos).
4. **Conversaciones**: historial completo por usuario; a cada petición solo viajan los últimos mensajes + un
   resumen + lo recuperado.

### 2.5 Acciones (la IA trabaja dentro de KROOPY)
- Herramientas que escriben: guardar idea, crear guion, convertir en tarea, añadir al calendario, planificar la semana.
- **Siempre piden confirmación** (tarjeta «¿Guardar esta idea?» con Aceptar / Cancelar) y se ejecutan en el servidor
  con el usuario del token. Lo creado se sincroniza solo con todos tus dispositivos.
- **Historial de actividad** de cada acción. Nunca publica en redes.

### 2.6 Seguridad y RGPD
Claves solo en variables de entorno de Netlify (ámbito *Functions*) · tokens de redes **cifrados** (AES-256-GCM) ·
límites por usuario y por IP · validación con zod · instrucciones del sistema contra *prompt injection*
(los datos y textos externos se tratan como datos, nunca como órdenes; las escrituras exigen confirmación) ·
exportar y borrar todo (cuenta, memoria, conversaciones) · política de privacidad actualizada con Google como encargado.

---

## 3. Redes sociales: lo que es posible de verdad

| | Instagram | YouTube | TikTok |
|---|---|---|---|
| API oficial | Instagram API con Instagram Login | YouTube Data API + YouTube Analytics API | Login Kit + Display API |
| Requisito de cuenta | Profesional (Creador o Empresa) | Canal propio | Cualquiera |
| Datos | Seguidores, visualizaciones, alcance, interacciones, likes, comentarios, compartidos, guardados por publicación y Reel (según permisos) | Suscriptores, visualizaciones, likes, comentarios, compartidos, tiempo de visualización, duración media, suscriptores ganados/perdidos, por vídeo | Seguidores, siguiendo, likes totales, nº de vídeos; por vídeo: visualizaciones, likes, comentarios, compartidos. **No da alcance ni tiempo de visualización.** |
| Solo para ti | Acceso estándar: sin revisión de Meta si la cuenta es tuya | Funciona; en modo «Prueba» los permisos caducan a los 7 días → hay que publicar la app de Google | Sandbox con cuentas de prueba |
| Para otros creadores (SaaS) | Acceso avanzado: revisión de la app + verificación del negocio | Verificación de Google (permisos sensibles) | Revisión de la app por TikTok |
| Coste | Gratis | Gratis (cuota diaria gratuita) | Gratis |

- Sin contraseñas de redes en KROOPY: botón «Conectar» → autorizas en la plataforma → vuelves conectado (OAuth oficial).
- Tokens solo en el servidor, cifrados, con renovación automática y desconexión.
- **Histórico**: una tarea programada diaria guarda una «foto» de las métricas para comparar semanas y meses.
- TikTok *Data Portability API* (EEE/Reino Unido) sirve para exportaciones de datos con aprobación previa, **no** para analítica en tiempo real.
- Sin agregadores de pago (Ayrshare, etc.): las APIs oficiales cubren lo necesario.

---

## 4. Presupuesto mensual previsto
| Servicio | Coste |
|---|---|
| Netlify Free (hosting, funciones, Blobs) | 0 € (300 créditos; vigilar despliegues) |
| Gemini API de pago con tope | ~2–5 € (tope recomendado: 8 €) |
| Meta, Google Cloud (YouTube), TikTok | 0 € |
| **Total** | **≈ 2–5 €/mes** |

---

## 5. Plan por etapas
| # | Etapa | Lo hago yo | Necesito de ti |
|---|---|---|---|
| 0 | Producción protegida | Preparar rama de pruebas | Cambiar en Netlify la rama de producción (te guío) y darme permiso para crear la rama `main` |
| 1 | Auditoría y arquitectura | ✅ Este documento | Elegir proveedor |
| 2 | KROOPY AI v1 | Función de IA, capa de modelos, cuotas, registro de costes | **Una clave de Gemini** (te guío paso a paso) |
| 3 | Chat | Página KROOPY AI con Kroo (piensa, escribe, celebra), streaming, detener, copiar, regenerar, historial, sugerencias, móvil | — |
| 4 | Memoria | Herramientas de lectura de tus datos, memoria persistente, pantalla para verla/borrarla | — |
| 5 | Acciones | Guardar ideas, guiones, tareas, eventos con confirmación + historial | — |
| 6 | Instagram | OAuth, métricas, histórico | Crear app en Meta (te guío) |
| 7 | YouTube | OAuth, Analytics, histórico | Proyecto en Google Cloud (te guío) |
| 8 | TikTok | OAuth, Display API, solicitud de revisión | App en TikTok Developers (te guío) |
| 9 | Analítica unificada + recomendaciones | Panel por plataforma, comparativas, la IA razona con datos reales | — |
| 10 | Preparación SaaS | Pruebas de aislamiento entre usuarios, cuotas por plan (sin pagos) | — |

En cada etapa: implementar → probar → corregir → documentar → explicarte el resultado.
Nada se publica en kroopy.es sin tu autorización.

---

## 6. Notas sobre la mascota
- La mascota «Kirby» de Avatar Lab reproduce al personaje de Nintendo (esfera rosa con pies). Para un producto
  comercial eso es un riesgo legal (marca y personaje protegidos), así que KROOPY usa **Kroo**, un personaje
  original con los colores de la marca. Si diseñas otro personaje original en Avatar Lab, basta con sustituir
  `src/assets/kroo.avatar.json`.
- El repositorio de Avatar Lab es **AGPL-3.0** (obligaría a publicar el código de KROOPY si se ofrece como SaaS):
  no se copia nada de él. Solo se usan los paquetes npm `@bible-strong/avatar-react` y `avatar-core`, que son **MIT**.
- El motor de la mascota (≈ 83 KB comprimido) se carga aparte, después de mostrar la app.

## Fuentes
- Gemini: [precios](https://ai.google.dev/gemini-api/docs/pricing) · [modelos](https://ai.google.dev/gemini-api/docs/models) · [facturación y topes](https://ai.google.dev/gemini-api/docs/billing) · [términos](https://ai.google.dev/gemini-api/terms) · [3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
- Netlify: [cómo funcionan los créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) · [planes](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) · [AI Gateway](https://docs.netlify.com/build/ai-gateway/overview/)
- AI SDK: [chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) · [herramientas en el chat](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) · [aprobación de herramientas](https://ai-sdk.dev/docs/agents/tool-approvals)
- Instagram: [API con Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login) · [revisión de apps](https://developers.facebook.com/documentation/instagram-platform/app-review) · [insights](https://developers.facebook.com/documentation/instagram-platform/insights)
- TikTok: [Display API](https://developers.tiktok.com/docs/en/display-api-overview) · [scopes](https://developers.tiktok.com/doc/tiktok-api-scopes)
- Google OAuth: [caducidad en modo prueba](https://developers.google.com/identity/protocols/oauth2) · [audiencia de la app](https://support.google.com/cloud/answer/15549945)
