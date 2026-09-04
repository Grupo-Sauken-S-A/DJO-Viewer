# Guía técnica para desarrolladores — djo-viewer

Esta guía explica de qué se trata la aplicación, qué es una DJO, cómo se construye y firma, y cómo djo-viewer la interpreta y valida. Es el punto de entrada conceptual del proyecto — para el detalle exhaustivo de cada regla, con su fuente y su porqué, ver [`BUSINESS_RULES.md`](BUSINESS_RULES.md). Para instalación, scripts y estructura de carpetas, ver el [`README`](../README.md).

## 1. Qué es esta aplicación

**djo-viewer** es un visualizador de **Declaraciones Juradas de Origen (DJO) Digital** — un formato que define exclusivamente Grupo Sauken S.A. para su propio sistema de gestión de certificados de origen (a diferencia de COD, que sigue el estándar ALADI/MERCOSUR).

La aplicación toma un archivo XML de DJO (subido a mano o vía URL), lo valida (versión, elementos permitidos, codificación, tamaño), muestra sus datos, informa el estado de sus firmas digitales y en qué etapa del proceso de emisión se encuentra, y permite exportar todo eso a PDF (`jsPDF`, misma lógica de negocio que la vista web — ver [`BUSINESS_RULES.md` §10](BUSINESS_RULES.md#10-el-pdf-exportado)).

## 2. Qué es una DJO, en concepto

Una DJO es un archivo XML UTF-8 con una estructura fija por versión (hoy: solo la 1.0.0), que contiene los datos de un exportador, un producto y su origen. A diferencia de COD, es un formulario de **un solo producto** (con variantes) en vez de una lista de mercaderías, y no tiene facturas ni transporte.

Al igual que COD, una DJO se **firma digitalmente dos veces**, por dos actores distintos, en dos momentos distintos:

- **El Exportador (EXP)** carga los datos y firma el elemento `<DJO id="DJO">`.
- **Un Funcionario Habilitado (FH)**, de una Entidad Habilitada (EH), agrega los datos de aprobación (`<EH>`/`<ApprovalEH>`) y firma el elemento `<DJOEH id="DJOEH">`, que abarca todo el documento — incluida la firma del Exportador.

Este mecanismo de dos firmas en dos momentos es la clave para entender casi todo lo demás: por qué el XML tiene la forma que tiene, por qué las validaciones de firma comparan contra fechas distintas para cada una, y por qué existe el concepto de "DJO en proceso". El detalle completo, con el XML real de ejemplo en cada etapa, está en [`BUSINESS_RULES.md` §2](BUSINESS_RULES.md#2-cómo-se-construye-y-firma-una-djo-las-4-etapas).

## 3. Versión: el único eje relevante (a diferencia de COD)

COD tiene dos ejes que cruzan todas sus reglas (versión **y** acuerdo comercial). DJO solo tiene uno: **`<DJOVer>`** — hoy conviven **`1.0.0` y `2.0.0`**, ambas vigentes indefinidamente (no es una migración). El acuerdo comercial (`<AgreementAcronym>`) sigue siendo **meramente informativo** — ningún requerimiento de campo ni validación depende de *qué* acuerdo sea. No busques ni construyas un "AGREEMENT_MAPPING" para DJO como el que tiene COD-Viewer: no aplica.

Lo que sí depende de la versión es qué **elementos** puede traer el XML — `src/lib/djo-spec.js` mantiene esa lista por versión (`ALLOWED_ELEMENTS_BY_VERSION`) y la valida `getUnknownElements()`. A diferencia de COD, no hay una tabla de requerimiento (M/O/NC) por campo: **todo elemento definido para la versión se muestra siempre**, tenga o no contenido (la revisión de contenido la hace un humano — el FH — de forma visual).

**Desde v2.0.0, la versión también determina la ESTRUCTURA**, no solo la whitelist: `<Agreement>` pasa de único a repetible (con nomenclatura propia por acuerdo). Es la primera vez que `DJOViewer.jsx`/`pdf-generator.js` ramifican por `DJOVer` para decidir *cómo* renderizar algo, no solo *si* un elemento es válido — ver [`BUSINESS_RULES.md` §3](BUSINESS_RULES.md#3-versiones-de-djo-y-elementos-permitidos) para el detalle completo y el patrón a seguir si aparece otra diferencia estructural en una versión futura.

## 4. Firmas digitales: qué se verifica y qué no

djo-viewer verifica la **presencia** de las dos firmas (por `Reference URI="#DJO"` / `="#DJOEH"`), el algoritmo usado, si el certificado del firmante estaba dentro de su período de vigencia **en el momento real de esa firma**, firmas duplicadas, y la **integridad criptográfica real**: recalcula el digest del contenido firmado y verifica `SignatureValue` contra la clave pública del certificado embebido, vía `xml-crypto` (`POST /api/verify-signature-integrity`, corre server-side). Si el contenido fue editado después de firmarlo, se detecta y se marca en rojo.

Lo que **no** hace, y lo aclara explícitamente en la propia interfaz: no valida la cadena de confianza del certificado, y no consulta si el certificado fue revocado (OCSP/CRL). Todo el detalle técnico está en [`BUSINESS_RULES.md` §7`](BUSINESS_RULES.md#7-firmas-digitales).

## 5. La etapa de emisión

Como la DJO se construye en 4 pasos (§2), un archivo puede llegar a esta app en cualquier punto intermedio del proceso — no necesariamente terminado. La app detecta en cuál de las 4 etapas está (o si el orden de firmas es inconsistente) y lo avisa de forma bien visible, sin ocultar el resto de los datos ya cargados. Detalle en [`BUSINESS_RULES.md` §8`](BUSINESS_RULES.md#8-etapa-de-emisión-detectada-por-la-app).

## 6. Cómo está organizado el código

```
src/
  app/
    api/proxy/route.js       # trae un XML por URL server-side (evita CORS); valida
                              # el Content-Type y el tamaño (4MB) de la respuesta antes
                              # de aceptarla, y pasa el cuerpo tal cual (sin decodificar)
                              # para no perder un eventual BOM en el camino
    api/verify-signature-integrity/route.js  # verificación XMLDSig real (digest +
                              # SignatureValue vía xml-crypto) — corre server-side
    layout.js, page.js        # shell de Next.js (App Router)
  components/
    DJOViewer.jsx              # componente principal: carga el XML, corre las
                                # validaciones y arma la vista
    pdf-generator.js           # genera el PDF con la misma lógica de negocio que
                                # la vista web (sin tabla de datos separada)
    signature-components.js    # UI: campos, alertas (validación de entrada, etapa
                                # de emisión, estado de firmas)
    signature-utils.js         # firmas digitales + etapa de emisión (sin UI)
    country-codes.js           # códigos de país → nombre
  lib/
    djo-spec.js                 # elementos permitidos por versión de DJO
    input-validation.js         # validaciones de codificación/estructura/tamaño/BOM del XML
    app-version.js              # versión de la app (de package.json), para mostrarla
                                 # en pantalla sin confundirla con DJOVer
test/
  pipeline.test.js               # test de integración: replica DJOViewer.processXML() de
                                  # punta a punta contra entradas inválidas y las 7 DJO reales
  fixtures/real/                # DJO reales de referencia (gitignorado, no se publica)
  helpers/fixtures.js           # utilidades para cargar/mutar esos fixtures en los tests
```

**Principio de diseño a mantener**: toda regla de negocio vive en `src/lib/` o en `signature-utils.js`, no en el JSX de `DJOViewer.jsx` salvo el propio renderizado de campos.

## 7. Extracción de datos del XML: por nombre de tag, no por ruta

El XML real de una DJO tiene más anidamiento del que sugiere la interfaz (ver la estructura completa en [`BUSINESS_RULES.md` §2](BUSINESS_RULES.md#2-cómo-se-construye-y-firma-una-djo-las-4-etapas)). La app no navega esa estructura por rutas fijas — usa `xmlData.querySelector('NombreDeTag')`, que encuentra el elemento sin importar cuántos padres tenga en el medio. Esto simplifica mucho el código, pero también significa que si algún día se reutiliza el mismo nombre de tag en dos contextos distintos dentro del mismo documento, `querySelector` tomaría el primero que encuentre.

## 8. Por dónde seguir

- Para tocar qué elementos son válidos por versión: `src/lib/djo-spec.js`, y leer [`BUSINESS_RULES.md` §3`](BUSINESS_RULES.md#3-versiones-de-djo-y-elementos-permitidos) antes de cambiar nada.
- Para tocar validaciones de entrada o de firmas: `src/lib/input-validation.js` / `src/components/signature-utils.js`, y [`BUSINESS_RULES.md` §6-8`](BUSINESS_RULES.md#6-validaciones-sobre-el-archivo-xml-de-entrada).
- Para tocar el PDF: `src/components/pdf-generator.js`, y [`BUSINESS_RULES.md` §10`](BUSINESS_RULES.md#10-el-pdf-exportado) — si se agrega un campo nuevo a `DJOViewer.jsx`, agregarlo también acá (no hay una fuente de datos única compartida entre los dos, a diferencia de las validaciones/firmas).
- Para instalar, correr o entender la estructura de carpetas: [`README.md`](../README.md).
- Para saber cómo corre en producción o instalar una versión nueva ahí: [`DEPLOYMENT.md`](DEPLOYMENT.md).
- Antes de "reinventar" algo que suene a que ya debería existir: revisar primero el proyecto hermano `C:\cod-viewer` (mismo mecanismo de firmas) — puede que ya esté resuelto ahí y solo haga falta adaptarlo, aunque **no todo aplica igual** (ver `AGENTS.md`, sección "Proyecto hermano: COD-Viewer").
