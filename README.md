# DJO Viewer

Visualizador de Declaraciones Juradas de Origen (DJO) Digital — un formato definido por Grupo Sauken S.A. para su propio sistema de gestión de certificados de origen.

Desarrollado por [Sauken](https://sauken.com.ar/) para [Certificados de Origen](https://certificadoorigen.com.ar/).

## Qué hace

- Carga un XML de DJO desde el disco, o automáticamente vía el parámetro `?xmlUri=<url>` en la URL (por ejemplo `http://localhost:3001/?xmlUri=https://ejemplo.com/declaracion.xml`) — el XML se trae a través de `/api/proxy`, una ruta interna que evita problemas de CORS al pedirlo desde el navegador. Esto permite que cualquier sistema externo, de cualquier organización o red, arme un enlace directo a una DJO específica para visualizarla sin pasos manuales.
- Valida el archivo de entrada: codificación UTF-8, BOM, versión de DJO reconocida, elementos fuera de los definidos para esa versión, estructura básica, `Content-Type` de la URL remota — avisa sin bloquear la vista, salvo el tamaño (máximo 4 MB), que sí bloquea el procesamiento.
- Muestra **todos** los campos definidos para la versión de la DJO, tengan o no contenido — a diferencia de COD, en DJO no hay campos que se oculten según acuerdo comercial (el acuerdo es meramente informativo).
- Verifica las firmas digitales (XMLDSig) de los elementos `DJO` y `DJOEH`: algoritmo, firmante, si el certificado estaba vigente en el momento real de esa firma (no en el momento de mirarlo), y la **integridad criptográfica real** (recalcula el digest y verifica `SignatureValue` — detecta si el documento fue editado después de firmarlo, vía [`/api/verify-signature-integrity`](src/app/api/verify-signature-integrity/route.js)). No valida revocación ni la cadena de confianza del certificado.
- Detecta en qué etapa del proceso de emisión está la DJO (borrador, firmado por el Exportador, aprobado por la Entidad Habilitada, completo) y lo avisa si no está terminado, o si el orden de firmas es inconsistente.

## Más documentación

- [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) — qué es una DJO, cómo se construye y firma, cómo la interpreta esta app. Punto de entrada conceptual para quien no conozca el dominio.
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) — referencia exhaustiva de cada regla de negocio y validación, con su fuente y su porqué.
- [`AGENTS.md`](AGENTS.md) — reglas de diseño que no hay que "corregir" por iniciativa propia (proxy abierto, sin CORS global, etc.), pensado para agentes de IA que trabajen en este repo.
- [`SECURITY.md`](SECURITY.md) — qué decisiones de seguridad son intencionales (no reportar como vulnerabilidad) y cómo reportar un problema real.

## Requisitos

- Node.js `>= 24.15.0` (lo exige `jsdom`, usado por la suite de tests)

## Instalación y uso

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3001`.

Otros scripts disponibles:

```bash
npm run build      # build de producción
npm run start      # sirve el build de producción
npm run lint       # eslint
npm test           # corre la suite de tests (Vitest)
npm run test:watch
```

## Tests

El suite (`npm test`) cubre `src/lib/input-validation.js`, `src/lib/djo-spec.js`, `src/components/signature-utils.js` y `POST /api/verify-signature-integrity`, con casos sintéticos.

Una parte de los tests usa DJO reales de referencia como fixtures (para probar contra la estructura real y las 4 etapas del proceso de emisión). Esos XML **no están en el repositorio** por contener datos de negocio reales — van en `test/fixtures/real/` (gitignorado) y los tests que los necesitan se saltan solos si el directorio no existe, así que `npm test` funciona igual en un clon nuevo del repo, solo que con menos cobertura.

## Estructura del proyecto

```
src/
  app/
    api/proxy/route.js                       # proxy server-side para cargar XML por URL (?xmlUri=)
    api/verify-signature-integrity/route.js  # verificación criptográfica real (digest + SignatureValue vía xml-crypto)
    layout.js, page.js                        # layout y entrada de Next.js (App Router)
  components/
    DJOViewer.jsx             # componente principal: carga, valida, parsea y renderiza la DJO
    signature-components.js  # UI: campos y alertas (entrada, etapa de emisión, firmas)
    signature-utils.js       # firmas digitales (presencia/vigencia/integridad) + etapa de emisión
    country-codes.js         # mapeo de códigos de país a nombre
    ui/                        # componentes de UI reutilizables (Card, Alert, Tabs)
  lib/
    djo-spec.js                # elementos permitidos por versión de DJO
    input-validation.js        # validaciones de codificación, tamaño, BOM y estructura del XML de entrada
    app-version.js             # versión de la app (package.json), para mostrarla sin confundirla con DJOVer
test/
  fixtures/real/    DJO reales usadas como fixtures (gitignorado, no se publica)
  helpers/fixtures.js  Utilidades para cargar DJO reales y armar copias mutadas
```

## Licencia

Este proyecto está licenciado bajo la GNU General Public License v2.0 — ver [LICENSE](LICENSE).
