# DJO Viewer

Visualizador web de Declaraciones Juradas de Origen (DJO) Digital, desarrollado por [Sauken](https://sauken.com.ar/) para [Certificados de Origen](https://certificadoorigen.com.ar/).

Permite abrir un archivo XML de DJO de dos formas:

1. **Carga manual**: seleccionando un archivo `.xml` desde el navegador.
2. **Por URL**: agregando el parámetro `xmlUri` a la URL de la aplicación, por ejemplo:

   ```
   https://tu-dominio/?xmlUri=https://donde-sea/certificado.xml
   ```

   Esto permite que cualquier sistema externo (de cualquier organización o red) arme un enlace directo a un DJO específico para que se visualice sin pasos manuales.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- React 18
- Tailwind CSS

## Requisitos

- Node.js `>= 24.15.0` (lo exige `jsdom`, usado por la suite de tests)

## Desarrollo local

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3001`.

## Tests

```bash
npm test        # corre la suite una vez
npm run test:watch
```

Suite con [Vitest](https://vitest.dev/) + jsdom: `src/lib/input-validation.js`, `src/lib/djo-spec.js`, `src/components/signature-utils.js` y `POST /api/verify-signature-integrity`, con casos sintéticos y contra DJO reales de referencia (`test/fixtures/real/`, gitignorado por contener datos de negocio reales — los tests que los necesitan se saltan solos si el directorio no existe).

## Build de producción

```bash
npm run build
npm run start
```

## Cómo funciona la carga por URL

1. El navegador navega a `/?xmlUri=<url-del-xml>` (navegación normal de página, no requiere CORS).
2. El componente cliente llama a `/api/proxy?url=<url-del-xml>`.
3. Esa ruta corre en el servidor y hace `fetch()` del XML, evitando así restricciones de CORS del servidor de origen del archivo. Rechaza respuestas que no parezcan XML (`Content-Type` `html`/`json`/`image`/`video`/`audio`/`pdf`) y corta la lectura si el cuerpo supera 4 MB, pasando los bytes tal cual (sin decodificar) para preservar un eventual BOM.
4. El XML se decodifica preservando la información de BOM, se parsea en el navegador con `DOMParser`, y se renderiza la estructura del documento.

### Nota de diseño importante

El endpoint `/api/proxy` (ver [src/app/api/proxy/route.js](src/app/api/proxy/route.js)) acepta **cualquier** URL en el parámetro `url`, sin allowlist de dominios. Esto es **intencional**: el objetivo del producto es que cualquier aplicación, en cualquier computadora o red, pueda enlazar un DJO propio para visualizarlo acá, sin que el visualizador dependa de una lista cerrada de proveedores.

Quien despliegue o modifique este proyecto debe tener presente que esto habilita un patrón de proxy abierto (server-side request forgery, SSRF) por diseño. Antes de restringirlo (por ejemplo agregando una allowlist de hosts), confirmar que no rompe el caso de uso principal del producto. `next.config.js` **no** agrega headers CORS globales — se removieron porque no aportaban nada al caso de uso real (la carga por `?xmlUri=` ya funciona vía este proxy server-to-server, nunca sujeto a CORS) y solo ampliaban la superficie de abuso.

## Versionado de la DJO y campos permitidos

A diferencia de COD (regulado por ALADI), el formato DJO lo define exclusivamente **Grupo Sauken S.A.** para su propio sistema de gestión de certificados de origen — no hay una norma externa que consultar. La versión vigente es **1.0.0**. Una DJO puede omitir u dejar vacío cualquier campo de su versión, pero **nunca** puede traer un elemento no definido para esa versión. [src/lib/djo-spec.js](src/lib/djo-spec.js) mantiene la lista de elementos permitidos por versión (`ALLOWED_ELEMENTS_BY_VERSION`) y `getUnknownElements()` la valida contra el XML cargado. Cuando exista la versión 2.0.0 (con campos nuevos, todavía sin definir), hay que agregar su propia entrada a esa lista.

El `<AgreementAcronym>` es **meramente informativo** en DJO: a diferencia de COD, ningún campo ni validación depende de qué acuerdo declare el documento.

Todo campo definido para la versión se muestra siempre en pantalla, tenga o no contenido — la validación de contenido la hace un Funcionario Habilitado (FH) de forma visual, así que ocultar un campo vacío le ocultaría justamente lo que necesita revisar.

## Validaciones sobre el XML de entrada

Implementadas en [src/lib/input-validation.js](src/lib/input-validation.js), corridas desde `processXML()` en `DJOViewer.jsx`: codificación UTF-8 declarada en el prólogo, caracteres de reemplazo (indicio de mala decodificación), versión de DJO reconocida, elementos no definidos para la versión (ver arriba), presencia de `<DJOVer>`/`<AgreementAcronym>`, estructura mínima (`<DJO id="DJO">`/`<DJOEH id="DJOEH">`), BOM al inicio del archivo, y tamaño máximo de 4 MB (el único caso que **bloquea** en vez de solo advertir). Todas se muestran sin ocultar el resto del certificado.

## Etapa de emisión

La DJO se construye en 4 etapas (mismo mecanismo de dos firmas/dos actores que usa COD): 1) borrador sin firmar, 2) firmada por el Exportador (`#DJO`), 3) con datos de la Entidad Habilitada (`<EH>`/`<ApprovalEH>`) agregados pero sin firmar por el Funcionario Habilitado, 4) completa (`#DJOEH` también firmado). `getEmissionStage()` (`src/components/signature-utils.js`) detecta en cuál está el documento cargado y lo muestra con una alerta roja cuando no está completo (o si el orden de firmas es inconsistente — ej. datos de la EH presentes sin que el Exportador haya firmado), sin ocultar el resto del contenido ya cargado.

## Firmas digitales

Implementado en [src/components/signature-utils.js](src/components/signature-utils.js) + [POST /api/verify-signature-integrity](src/app/api/verify-signature-integrity/route.js):

- Presencia de `<ds:Signature>` para `#DJO` (Exportador) y `#DJOEH` (Entidad Habilitada), y detección de firmas duplicadas.
- Algoritmo real de firma (no solo de digest) — marca RSA-SHA1/MD5 como débil/obsoleto.
- Vigencia del certificado X.509 (parser ASN.1/DER propio), comparada contra la fecha real de cada firma (`DeclarationDate` para el Exportador, `ApprovalDate` para la Entidad Habilitada) — **nunca** contra la fecha de hoy.
- **Integridad criptográfica real** (vía `xml-crypto`, server-side): recalcula el digest del contenido firmado y verifica `SignatureValue` contra el certificado embebido — detecta si el documento fue editado después de firmado.

**No verifica** (y lo dice explícitamente en el texto que muestra): la cadena de confianza del certificado ni si estaba revocado (OCSP/CRL). Para esa validación sugiere usar otra herramienta (ej. S-FiDE).

## Estructura del proyecto

```
src/
  app/
    api/proxy/route.js                       Proxy server-side para cargar XML por URL
    api/verify-signature-integrity/route.js  Verificación XMLDSig real (digest + SignatureValue vía xml-crypto)
    layout.js            Layout raíz
    page.js              Página principal
    globals.css
  components/
    DJOViewer.jsx             Componente principal: carga, valida y renderiza la DJO
    signature-components.js  UI: campos, alertas de validación y de firmas
    signature-utils.js       Firmas digitales (sin UI)
    country-codes.js         Catálogo de países
    ui/                       Componentes de UI reutilizables (Card, Alert, Tabs)
  lib/
    input-validation.js  Validaciones de codificación/estructura/tamaño/BOM del XML
    djo-spec.js          Lista de elementos permitidos por versión de DJO
    app-version.js       Versión de la app (de package.json), para mostrarla en pantalla
test/
  fixtures/real/    DJO reales de referencia para tests (gitignorado)
  helpers/fixtures.js  Utilidades para cargar/mutar esos fixtures en los tests
```

## Licencia

Este proyecto está licenciado bajo la [GNU General Public License v2.0](LICENSE).
