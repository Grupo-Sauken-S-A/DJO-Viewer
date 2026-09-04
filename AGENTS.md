# Guía para agentes de IA (Claude Code y otros)

Contexto para cualquier agente que trabaje en este repositorio.

## Qué es este proyecto

Visualizador Next.js de Declaraciones Juradas de Origen (DJO) Digital, para Sauken / Certificados de Origen. Ver [README.md](README.md) para detalles funcionales, y sobre todo [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) + [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) antes de tocar cualquier lógica de versiones, validación de entrada, firmas o etapa de emisión — ahí está el porqué de cada regla, no solo el qué.

## Reglas importantes, no cambiar sin pedirlo explícitamente el usuario

1. **`src/app/api/proxy/route.js` es un proxy abierto a propósito.** Acepta cualquier URL sin allowlist de host (sí valida `Content-Type` y tamaño, ver README). Es el mecanismo que permite que cualquier app externa cargue un DJO propio vía `?xmlUri=`. No lo trates como un bug de seguridad a corregir por iniciativa propia (SSRF): ya fue señalado al usuario y decidió mantenerlo así. Ver [SECURITY.md](SECURITY.md) para la política completa.
2. **`next.config.js` NO define headers CORS globales** (se removió `Access-Control-Allow-Origin: *`, ver CHANGELOG v1.1.0) — no reintroducirlo. No aportaba nada al caso de uso real (la carga por `?xmlUri=` ya funciona vía el proxy, server-to-server, nunca sujeto a CORS) y solo ampliaba la superficie de abuso tipo SSRF.
3. **Sí se valida la firma digital XMLDSig** (presencia, algoritmo, vigencia del certificado contra la fecha real de la firma, firmas duplicadas, e integridad criptográfica real vía `xml-crypto`) — ver `src/components/signature-utils.js` + `POST /api/verify-signature-integrity`. Lo que deliberadamente **no** hace, y no se le debe pedir sin discutirlo primero: validar la cadena de confianza del certificado o consultar revocación (OCSP/CRL) — mismo criterio permanente que adoptó COD-Viewer (ver `docs` de ese proyecto hermano).
4. **DJO no tiene regulador externo** (confirmado por el dueño del proyecto, 2026-09-04): a diferencia de COD (ALADI), el formato DJO lo define exclusivamente Grupo Sauken S.A. para su propio sistema. No busques ni inventes un documento normativo tipo "ALADI_SEC_di2327" para DJO — no existe. La fuente de verdad de qué campos existen por versión es [src/lib/djo-spec.js](src/lib/djo-spec.js) (`ALLOWED_ELEMENTS_BY_VERSION`), y se actualiza a mano cuando el usuario confirme una versión nueva. Hoy hay dos versiones vigentes **a la vez** (`1.0.0` y `2.0.0`, ninguna reemplaza a la otra) — no asumir que la última versión conocida es la única que va a llegar en producción.
5. **El `<AgreementAcronym>` es meramente informativo en DJO** — a diferencia de COD, ningún campo, validación ni etapa depende de *qué* acuerdo declare el documento. No portar el patrón de COD-Viewer donde el acuerdo determina requerimientos de campo (M/O/NC por agreement) — no aplica acá y no hay que construirlo. (Esto es distinto de que `DJOVer` sí determine estructura desde v2.0.0 — ver regla 7.)
6. **Todo campo definido para la versión debe mostrarse siempre en pantalla, tenga o no contenido** (confirmado por el dueño del proyecto: la validación de contenido la hace un Funcionario Habilitado de forma visual). No portar el patrón de COD-Viewer de ocultar campos "NC" (no corresponde) — en DJO no existe ese concepto.
7. **Desde v2.0.0, `DJOVer` determina la estructura del documento, no solo la whitelist** (`<Agreement>` único en v1.0.0 vs. repetible en v2.0.0, ver [`BUSINESS_RULES.md` §3](docs/BUSINESS_RULES.md#3-versiones-de-djo-y-elementos-permitidos)). `DJOViewer.jsx` y `pdf-generator.js` ramifican explícitamente por `djoVer === '2.0.0'` (`DJOViewer.jsx`: `hasMultipleAgreements`; `pdf-generator.js`: `this.hasMultipleAgreements`), con la forma de v1.0.0 como default para cualquier versión no reconocida. Si aparece una versión nueva con otra diferencia estructural, seguir el mismo patrón — no generalizar de más con una sola muestra (todavía es un solo `if`, no una abstracción de "versionado de layout").

## Origen y plataforma

El código fue migrado desde un servidor de producción openSUSE Tumbleweed (Linux) a un entorno de desarrollo Windows. Por eso:

- `node_modules/` y `.next/` están en `.gitignore` y nunca deben commitearse: contienen binarios nativos compilados por plataforma (`@next/swc-*`, `@img/sharp-*`). Reinstalar con `npm install` en cada plataforma donde se ejecute.
- No asumir rutas o comandos de shell POSIX si se trabaja en Windows; verificar el shell disponible antes de sugerir comandos.

## Convenciones

- Componentes en `src/components/` usan JSX con `.jsx` cuando son componentes React con hooks visibles ("use client"), y `.js` para utilidades.
- Estilos con Tailwind CSS; ver `tailwind.config.js`.
- Sin TypeScript: el proyecto es JavaScript puro (ver `jsconfig.json` para paths, no `tsconfig.json`).
- `npm run lint` ejecuta `eslint .` directamente con config plana (`eslint.config.mjs`, basada en `eslint-config-next/core-web-vitals`). `next lint` fue removido del CLI de Next.js a partir de la v16 — no reintroducir ese script.

## Versionado

Se usa [versionado semántico](https://semver.org/lang/es/) estándar (`MAJOR.MINOR.PATCH`), con tags de git `vX.Y.Z`. La primera versión publicada es `v1.0.0`, sincronizada con `"version"` en `package.json`. Actualizar ambos en conjunto al liberar una nueva versión, y documentar los cambios en [CHANGELOG.md](CHANGELOG.md).

## Rama `main` protegida

`main` requiere pull request (no acepta push directo salvo administradores, ver abajo) y que pase el check de CI `build` (`.github/workflows/ci.yml`: `npm ci && npm run lint && npm test && npm run build`, Node 24 — Node 20 no alcanza, `jsdom@30` exige `^22.22.2||^24.15.0||>=26`) antes de mergear. No permite force-push ni borrado de la rama. No exige aprobaciones de revisión (`required_approving_review_count: 0`) y `enforce_admins` está en `false`, para no bloquear al mantenedor solo. Si el equipo crece, subir `required_approving_review_count` a 1+ y evaluar `enforce_admins: true`.

## Producción

Corre en el servidor `sknvm1` (`/djo-viewer`, puerto 3001, systemd `viewdjo.service`), con el proxy público TLS en un servidor separado (`sknnuc`). Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para la topología completa y cómo instalar una versión nueva — **no reinventar el mecanismo de systemd**: la unit actual (`Type=simple`, sin wrapper) corrige un bug real de procesos huérfanos que tenía el patrón viejo (`Type=forking` + script con un `npm run stop` que nunca existió).

## Proyecto hermano: COD-Viewer

DJO-Viewer nació como copia del proyecto `cod-viewer` (Certificados de Origen Digital, mismo mecanismo de 2 firmas/2 actores: Exportador firma `#DJO`/`#COD`, Entidad Habilitada agrega datos y firma `#DJOEH`/`#CODEH`). COD-Viewer evolucionó por separado y tiene features que DJO-Viewer todavía no — antes de "reinventar" algo de firmas/validación de entrada, revisar primero cómo lo resolvió COD-Viewer (`src/components/signature-utils.js`, `src/lib/input-validation.js` de ese repo) para no duplicar el trabajo de diseño.

**Ya implementado (2026-09-04), adaptado de COD-Viewer con la confirmación del dueño del proyecto:**
- **Etapa de emisión** (`getEmissionStage`, `src/components/signature-utils.js` + `EmissionStageAlert`): borrador → firmado por el Exportador (`#DJO`) → datos de la EH agregados (`<EH>`/`<ApprovalEH>`) → firmado por la EH (`#DJOEH`). Ver test fixtures reales en `test/fixtures/real/` (gitignorado) para los 4 ejemplos de cada etapa.
- **Whitelist de elementos por versión** (`src/lib/djo-spec.js`, `getUnknownElements()`, consumida desde `validateStructure()` en `input-validation.js`): reemplaza el equivalente de COD-Viewer ("elementos inesperados" por M/O/NC+acuerdo) con algo más simple, acorde a que DJO no tiene ese concepto — un elemento no enumerado para la versión declarada siempre se reporta, sin importar el acuerdo.
- **Exportar a PDF** (`src/components/pdf-generator.js`, botón "Ver en PDF" en `DJOViewer.jsx`): mismo patrón de clase `jsPDF` que COD-Viewer (sin `jspdf-autotable`, que COD tiene instalado pero no usa en ningún lado). **Diferencia deliberada**: el PDF de DJO no resalta en rojo un campo obligatorio vacío (COD-Viewer sí) — coherente con que `<Field>` tampoco lo hace en la vista web (ver el punto de `hasError` más abajo). Ver [`BUSINESS_RULES.md` §10](docs/BUSINESS_RULES.md#10-el-pdf-exportado).
- **Soporte para DJOVer 2.0.0** (`src/lib/djo-spec.js`, `DJOViewer.jsx`, `pdf-generator.js`): `<Agreement>` repetible con nomenclatura propia por acuerdo. Ver regla 7 más arriba y [`BUSINESS_RULES.md` §3](docs/BUSINESS_RULES.md#3-versiones-de-djo-y-elementos-permitidos).
- **Cantidad declarada visible en las 6 secciones repetibles** (`AgreementQty`, `GoodVariantQty`, `LocalSuppliesQty`, `IntrazoneSuppliesQty`, `ExtrazoneSuppliesQty`, `PACThirdCountrySuppliesQty`): cada una se muestra como `Field`/`addField` explícito, además del badge de conteo real del título de sección — a propósito, para poder detectar un desfasaje entre lo declarado y lo realmente presente en el XML. Si se agrega una sección repetible nueva, aplicar el mismo criterio (ver [`BUSINESS_RULES.md` §9](docs/BUSINESS_RULES.md#9-estructura-del-xml-real-vs-jerarquía-visual)).

**Deliberadamente pendiente, no implementar sin pedirlo el usuario:**
- **`Field` con prop `hasError`** (resaltado en rojo de obligatorio faltante) — se dejó tal cual estaba, sin ese resaltado, a pedido explícito del usuario.
- **Tabla de requerimientos M/O/NC data-driven por acuerdo** — no aplica a DJO (ver regla 5 arriba), no es "pendiente", es un no-implementar permanente.
- **Validación contra un XSD por versión** — el usuario dejó a criterio del asistente XSD vs. función interna; se eligió función interna (`djo-spec.js`) por ser más simple de mantener y porque la forma real de `<GoodVariant>` (ítems repetidos como hermanos planos, sin wrapper) es incómoda de expresar en XSD estricto. Si en el futuro se prefiere XSD, es un cambio de arquitectura a discutir, no una corrección.

**Pendiente confirmado, sin fecha:** puede llegar una versión 3.0.0 (u otra) con más campos nuevos — el usuario la especificará cuando corresponda. Cuando llegue, agregar su entrada a `ALLOWED_ELEMENTS_BY_VERSION`/`KNOWN_DJO_VERSIONS` en `djo-spec.js`, y evaluar si hace falta otra rama de renderizado (regla 7) o si encaja en alguna de las dos formas existentes.

## Licencia

GPL-2.0 (ver [LICENSE](LICENSE)). Cualquier código nuevo agregado a este repositorio se distribuye bajo los mismos términos.
