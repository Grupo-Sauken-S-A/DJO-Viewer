# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.4.3] - 2026-09-04

### Revertido

- Se saca el campo explícito "Cantidad de..." agregado en v1.4.1 (y el que ya existía para `AgreementQty` desde v1.4.0) en las 6 secciones repetibles (Acuerdos comerciales, Presentaciones del producto, Materiales locales/intrazona/extrazona/de terceros países PAC), tanto en la vista web como en el PDF. El usuario lo vio en producción y señaló que era un campo redundante — con el badge de conteo del título de sección alcanza, no hace falta un campo aparte. Al revisar el código se confirmó que, para 5 de las 6 secciones, el badge del título ya leía el mismo valor declarado que mostraba el campo (pura duplicación); solo en `Agreement` el badge es un conteo real distinto del valor declarado, pero el usuario decidió que tampoco hace falta mostrar ambos ahí. Ver `docs/BUSINESS_RULES.md` §9 para el detalle de por qué el badge no usa el mismo criterio en las 6 secciones.

## [1.4.2] - 2026-09-04

### Corregido

- Documentación desactualizada tras agregar el fixture `djo-ejemplo-v200.xml` (v1.4.0): `README.md` y `docs/DEVELOPER_GUIDE.md` seguían diciendo "6 DJO reales" en vez de 7; el párrafo de fuentes de `docs/BUSINESS_RULES.md` tampoco reflejaba las 7. `AGENTS.md` no tenía todavía la entrada de "Ya implementado" para el cambio de v1.4.1 (cantidad declarada en las 6 secciones repetibles).

## [1.4.1] - 2026-09-04

### Agregado

- Las 5 secciones repetibles que ya existían desde v1.0.0 (Presentaciones del producto, Materiales locales/intrazona/extrazona/de terceros países PAC) ahora muestran también la **cantidad declarada** en su propio `*Qty` (`GoodVariantQty`, `LocalSuppliesQty`, `IntrazoneSuppliesQty`, `ExtrazoneSuppliesQty`, `PACThirdCountrySuppliesQty`) como campo explícito, no solo como badge de conteo en el título de la sección — mismo tratamiento que ya tenía `AgreementQty` desde v1.4.0. Antes, un desfasaje entre la cantidad declarada y la cantidad real de ítems presentes en el XML quedaba invisible; ahora se puede detectar a simple vista comparando el campo contra el badge. En HTML y PDF.

## [1.4.0] - 2026-09-04

Soporte para la nueva versión de formato **DJOVer 2.0.0**, confirmada con un ejemplo real del dueño del proyecto. **v1.0.0 y v2.0.0 quedan ambas vigentes indefinidamente** — no es una migración.

### Agregado

- `src/lib/djo-spec.js`: `KNOWN_DJO_VERSIONS` incluye `'2.0.0'`; `ALLOWED_ELEMENTS_BY_VERSION['2.0.0']` agrega `AgreementQty`, `NomenclatureType`, `NomenclatureRev`, `AgreementNomenclatureCode` sobre la lista de v1.0.0 (todo lo demás es idéntico entre ambas versiones).
- **`<Agreement>` repetible en v2.0.0**: una DJO puede declararse bajo varios acuerdos comerciales a la vez, cada uno con su propia norma de origen y su propia clasificación arancelaria (nomenclatura/revisión/código pueden variar por acuerdo para el mismo producto). `DJOViewer.jsx` y `pdf-generator.js` ahora ramifican explícitamente por `DJOVer` (primera vez que la versión determina *estructura*, no solo la whitelist — ver `docs/BUSINESS_RULES.md` §3): v1.0.0 sigue mostrando una única sección "Acuerdo comercial"; v2.0.0 muestra "Acuerdos comerciales" con la cantidad declarada (`AgreementQty`) primero, seguida de un bloque por cada `<Agreement>`.
- `test/fixtures/real/djo-ejemplo-v200.xml`: DJO real de referencia en v2.0.0 (gitignorada), usada en los tests de `djo-spec`, `input-validation`, `signature-utils`, `pipeline` y `pdf-generator`.
- Tests nuevos: whitelist de v2.0.0 (sintéticos y contra el fixture real), cada fixture real ahora se valida contra **su propia** versión declarada (antes se asumía 1.0.0 para todas), etapa de emisión y generación de PDF verificadas también para el fixture v2.0.0.

### Corregido

- `docs/BUSINESS_RULES.md`/`AGENTS.md` ya no dicen que 1.0.0 es "la única versión" ni dejan v2.0.0 como "pendiente sin fecha" — quedan documentadas ambas versiones vigentes y el patrón a seguir si aparece una tercera con otra diferencia estructural.

## [1.3.1] - 2026-09-04

### Corregido

- `docs/DEPLOYMENT.md`: el ejemplo de "probar en un puerto libre antes de cortar producción" usaba `PORT=3099 npm start`, pero el script `"start"` de DJO-Viewer tiene el puerto fijo en `-p 3001` — esa variable de entorno no lo pisa. Corregido a `npx next start -p 3099`.

## [1.3.0] - 2026-09-04

### Agregado

- **Exportar a PDF** (`src/components/pdf-generator.js`, botón "Ver en PDF" junto a "Cargar otro archivo"): mismo patrón de clase basado en `jsPDF` que usa COD-Viewer (secciones por color/nivel, cajas de campo ámbar/gris, listas con encabezado por ítem, estado de firmas y alertas reutilizando `signature-utils.js` sin duplicar lógica) — sin `jspdf-autotable`, que COD-Viewer tiene como dependencia pero no llega a usar en ningún lado de su generador. La estructura, el orden y los campos calcan exactamente los de `DJOViewer.jsx` (información general, acuerdo, exportador, productor, producto y sus variantes, proceso de fabricación, los 4 grupos de materiales, declaración, EH y verificación). Archivo `DJO_<ApprovalNumber>_<fecha>.pdf`. Marca de agua diagonal "EN PROCESO — NO VÁLIDO" cuando la DJO no está completa. Detalle completo en `docs/BUSINESS_RULES.md` §10.
- `src/components/pdf-generator.test.js`: test de humo (genera el PDF completo contra las 6 DJO reales y variantes mutadas — sin firma del FH, con advertencias, sin certificado X.509 — verificando que no lance excepción), mismo patrón que el de COD-Viewer.
- Verificado manualmente en navegador (no solo en jsdom): el Blob generado es un PDF válido (`%PDF-1.3` ... `%%EOF`) tanto para una DJO completa como para una en etapa 1 (con marca de agua), sin errores de consola.

### Nota de diseño

A diferencia de COD-Viewer, el PDF de DJO **no** resalta en rojo un campo obligatorio que esté vacío — se mantiene coherente con que el componente `<Field>` de la vista web tampoco lo hace (decisión explícita del dueño del proyecto, v1.1.0/v1.2.0). Un campo obligatorio vacío se ve como "No especificado" dentro de su caja ámbar, igual en pantalla que en el PDF.

## [1.2.3] - 2026-09-04

Auditoría de consistencia de toda la documentación tras la instalación en producción (ver `docs/DEPLOYMENT.md`, nuevo en esta versión).

### Agregado

- `docs/DEPLOYMENT.md`: topología real de producción (servidor `sknvm1`, puerto 3001, proxy TLS en `sknnuc`), el unit de systemd correcto (`Type=simple`) y por qué, y el procedimiento de instalación/actualización/rollback. Esta información existía solo de forma dispersa hasta ahora.

### Corregido

- `AGENTS.md` describía el CI como `npm ci && npm run lint && npm run build`, sin `npm test` (que sí corre desde que se agregó la suite de tests en v1.1.0) — corregido para reflejar el workflow real, y se agrega la versión de Node exigida.
- `README.md` y `docs/DEVELOPER_GUIDE.md` no mencionaban `test/pipeline.test.js` (agregado en v1.2.2) en la sección de tests ni en el árbol de archivos — agregado en ambos.
- Se agregan referencias cruzadas a `docs/DEPLOYMENT.md` desde `README.md`, `AGENTS.md` y `docs/DEVELOPER_GUIDE.md`.

## [1.2.2] - 2026-09-04

### Agregado

- `test/pipeline.test.js`: replica `DJOViewer.processXML()` de punta a punta (parseo, validaciones de entrada, etapa de emisión) con casos sintéticos de entradas inválidas y contra las 6 DJO reales de referencia (mismo patrón que ya tiene COD-Viewer).
- `.github/CODEOWNERS`: preparado para cuando el equipo crezca — sin efecto hasta que se active "Require review from Code Owners" en la protección de la rama `main`.
- `.gitattributes` (`* text=auto eol=lf`): normaliza los finales de línea a LF en el repositorio, evitando el warning de "LF será reemplazado por CRLF" en cada commit desde Windows.

### Corregido

- `SECURITY.md` apuntaba a `info@sauken.com.ar` como casilla de reporte de seguridad; se cambia a `soporte@sauken.com.ar`.

## [1.2.1] - 2026-09-04

### Docs

- Se agregan `docs/BUSINESS_RULES.md` (referencia exhaustiva de reglas de negocio y validaciones, con su fuente y su porqué) y `docs/DEVELOPER_GUIDE.md` (guía narrativa de onboarding), mismo patrón que ya usa el proyecto hermano COD-Viewer — pensados también para que agentes de IA los lean antes de tocar lógica de versiones, validación de entrada, firmas o etapa de emisión.
- Se agrega `SECURITY.md`: documenta el proxy abierto y la falta de validación de cadena de confianza/revocación como decisiones de diseño intencionales (no reportar como vulnerabilidad), y cómo reportar un problema real.
- Se recorta `README.md` (movía contenido detallado de reglas de negocio al nuevo `docs/`, README queda enfocado en instalación/uso/estructura, siguiendo el mismo formato que el README de COD-Viewer).
- Se corrigen referencias cruzadas en `AGENTS.md` a la nueva documentación.

## [1.2.0] - 2026-09-04

Reglas de negocio de DJO confirmadas directamente por el dueño del proyecto (no hay regulador externo como ALADI para COD — Grupo Sauken S.A. define el formato DJO para su propio sistema). Con esa base, se completan dos de los puntos que habían quedado pendientes en v1.1.0.

### Agregado

- **Whitelist de elementos por versión de DJO** ([src/lib/djo-spec.js](src/lib/djo-spec.js)): `ALLOWED_ELEMENTS_BY_VERSION` enumera los elementos válidos para la versión 1.0.0 (única vigente hoy); `getUnknownElements()` detecta cualquier elemento no definido para la versión declarada. Integrado en `validateStructure()` (`src/lib/input-validation.js`), que ahora también valida que `<DJOVer>` sea una versión reconocida (`KNOWN_DJO_VERSIONS`). El `<AgreementAcronym>` sigue sin validarse contra una lista: es meramente informativo en DJO, ningún campo depende de él.
- **Detección de etapa de emisión** (`getEmissionStage`, `src/components/signature-utils.js` + `EmissionStageAlert`, `src/components/signature-components.js`): borrador sin firmar → firmado por el Exportador (`#DJO`) → datos de la Entidad Habilitada agregados (`<EH>`/`<ApprovalEH>`) sin firmar por el Funcionario Habilitado → completa (`#DJOEH` también firmado). Se muestra con una alerta roja cuando el documento no está completo o el orden de firmas es inconsistente, sin ocultar el resto del contenido ya cargado.
- Fixtures de DJO reales de referencia (`test/fixtures/real/`, gitignorado) provistas por el dueño del proyecto, usadas para verificar ambas funcionalidades contra documentos reales en cada una de las 4 etapas.

### Corregido

- Los mensajes de `input-validation.js` atribuían erróneamente los requisitos de codificación UTF-8/sin BOM a "ALADI" o a "la autoridad aduanera" — corregido para reflejar que son requisitos del propio formato DJO de Sauken, no de un regulador externo.

## [1.1.1] - 2026-09-04

### Corregido

- CI (`.github/workflows/ci.yml`) corría `npm test` con Node 20, pero `jsdom@30` (agregado en v1.1.0) exige `^22.22.2 || ^24.15.0 || >=26.0.0` — fallaba en GitHub Actions aunque pasaba en local (Node 24). Se sube el CI a Node 24 y se corrige `engines.node` en `package.json` (antes `>=20.9.0`, ya no alcanza) para reflejar el requisito real.

## [1.1.0] - 2026-09-04

Pone al día a DJO-Viewer con mejoras que ya existían en el proyecto hermano COD-Viewer (ambos nacieron de la misma copia de producción, pero COD-Viewer evolucionó por separado). Quedan pendientes, a propósito: etapa de emisión, detección de elementos inesperados, resaltado de error en `Field`, whitelist de versiones/acuerdos reconocidos y la tabla M/O/NC data-driven (requieren fuente regulatoria de DJO — ver AGENTS.md).

### Agregado

- **Validaciones sobre el XML de entrada** (`src/lib/input-validation.js`): codificación UTF-8 declarada, caracteres de reemplazo, presencia de `<DJOVer>`/`<AgreementAcronym>`/`<DJO id="DJO">`/`<DJOEH id="DJOEH">`, BOM, y límite de tamaño de 4 MB (bloqueante, a diferencia del resto). Mostradas vía `InputValidationAlert`.
- **Firmas digitales enriquecidas** (`src/components/signature-utils.js`): algoritmo real de firma (marca RSA-SHA1/MD5 como débil), vigencia del certificado X.509 (parser ASN.1/DER propio) comparada contra la fecha real de cada firma (`DeclarationDate`/`ApprovalDate`, nunca contra hoy), y detección de firmas duplicadas.
- **Verificación criptográfica real de integridad de firma** (`POST /api/verify-signature-integrity`, vía `xml-crypto`): recalcula el digest del contenido firmado y verifica `SignatureValue` contra el certificado embebido — detecta si el documento fue editado después de firmado. Antes, la app solo comprobaba presencia de la firma.
- El proxy (`/api/proxy`) ahora valida `Content-Type` de la respuesta remota (rechaza `html`/`json`/`image`/`video`/`audio`/`pdf`), corta la lectura si supera 4 MB, y pasa el cuerpo en bytes crudos (sin decodificar) para preservar un eventual BOM.
- Versión de la aplicación (`package.json`) visible de forma discreta en pantalla, desde un único punto de verdad en `src/lib/app-version.js`.
- Suite de tests automatizados (Vitest + jsdom): `src/lib/input-validation.js`, `src/components/signature-utils.js` y `POST /api/verify-signature-integrity`, con casos sintéticos.
- Nota sobre alcance de la verificación de firmas: aclara explícitamente qué no valida (cadena de confianza, revocación) y sugiere S-FiDE como alternativa.

### Removido

- El bloque `headers()` de `next.config.js` que agregaba `Access-Control-Allow-Origin: "*"` (y otros headers CORS) a todas las rutas. No tenía ningún efecto sobre la carga de `?xmlUri=` de cualquier dominio (eso ya funciona vía `/api/proxy`, un fetch server-to-server que nunca estuvo sujeto a CORS) — solo habilitaba que sitios de terceros llamaran a los endpoints de esta app desde el navegador de sus propios visitantes, ampliando la superficie de abuso tipo SSRF sin aportar nada al caso de uso real.

## [1.0.1] - 2026-09-02

### Corregido

- `npm run lint` fallaba porque usaba `next lint`, comando removido del CLI de Next.js en la v16. Ahora corre `eslint .` con config plana propia (`eslint.config.mjs`) basada en `eslint-config-next/core-web-vitals`.

## [1.0.0] - 2026-09-02

### Agregado

- Primera versión publicada del repositorio, migrada desde el servidor de producción (openSUSE Tumbleweed) al entorno de desarrollo actual.
- Visualizador de Declaración Jurada de Origen (DJO) Digital: carga manual de XML y carga por URL (`?xmlUri=`) vía proxy server-side.
- Detección de presencia de firmas digitales XMLDSig (sin validación criptográfica).
- Documentación del proyecto: README, AGENTS.md y licencia GPL-2.0.
