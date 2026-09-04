# Reglas de negocio y validaciones de djo-viewer

Este documento es la referencia exhaustiva de **todas** las reglas de negocio, validaciones y decisiones de diseño de esta aplicación: de dónde salen, por qué son así, y dónde están implementadas. Está pensado tanto para desarrolladores humanos como para asistentes de IA que trabajen sobre este código — léelo antes de tocar cualquier lógica relacionada con versiones, campos, firmas o validación de XML.

Fuentes usadas para armar este documento: confirmación directa de Juan Carlos Rios (dueño del proyecto, Grupo Sauken S.A., 2026-09-04) y 6 DJO de ejemplo (`test/fixtures/real/`, gitignoradas) que cubren las 4 etapas reales del proceso de emisión.

## Índice

1. [Qué es una DJO y quién la regula](#1-qué-es-una-djo-y-quién-la-regula)
2. [Cómo se construye y firma una DJO (las 4 etapas)](#2-cómo-se-construye-y-firma-una-djo-las-4-etapas)
3. [Versiones de DJO y elementos permitidos](#3-versiones-de-djo-y-elementos-permitidos)
4. [El Acuerdo comercial es meramente informativo](#4-el-acuerdo-comercial-es-meramente-informativo)
5. [Todo campo de la versión se muestra siempre](#5-todo-campo-de-la-versión-se-muestra-siempre)
6. [Validaciones sobre el archivo XML de entrada](#6-validaciones-sobre-el-archivo-xml-de-entrada)
7. [Firmas digitales](#7-firmas-digitales)
8. [Etapa de emisión detectada por la app](#8-etapa-de-emisión-detectada-por-la-app)
9. [Estructura del XML real vs. jerarquía visual](#9-estructura-del-xml-real-vs-jerarquía-visual)
10. [El PDF exportado](#10-el-pdf-exportado)
11. [Decisiones de seguridad deliberadas](#11-decisiones-de-seguridad-deliberadas)
12. [Deuda conocida / pendiente explícito](#12-deuda-conocida--pendiente-explícito)

---

## 1. Qué es una DJO y quién la regula

Una **Declaración Jurada de Origen (DJO) Digital** es un XML UTF-8 con una estructura definida exclusivamente por **Grupo Sauken S.A.**, para uso interno de su propio sistema de gestión de certificados de origen. **A diferencia de COD (proyecto hermano de esta app, ver [`C:\cod-viewer`](../../cod-viewer)), no existe ningún regulador externo tipo ALADI para DJO** — no hay un PDF o norma pública que consultar; Sauken es la única fuente de verdad (confirmado por el dueño del proyecto, 2026-09-04).

Hay dos actores, con el mismo mecanismo que usa COD:

- **EXP (Exportador)**: carga los datos del formulario y firma digitalmente el elemento con `id="DJO"`.
- **FH (Funcionario Habilitado)** de una Entidad Habilitada (EH): agrega los datos de aprobación y firma digitalmente el elemento con `id="DJOEH"`.

## 2. Cómo se construye y firma una DJO (las 4 etapas)

Confirmado empíricamente contra 6 DJO de ejemplo reales, provistas por el dueño del proyecto (`test/fixtures/real/`, gitignoradas):

1. **Sin firmas** (`djo-exportador.xml`): `<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO">` con `DJOVer`, `DJOSubmitterType=EXP`, `Agreement`, `Exporter`, `Producer`, `Declaration`, `FormDJO` — solo datos del exportador y del formulario, sin `<EH>`/`<ApprovalEH>`.
2. **Firma del EXP** (`djo-exportador-signed.xml`): se agrega `<ds:Signature>` con `Reference URI="#DJO"` como **hermano** de `<DJO>`, dentro de `<DJOExporter>` (no dentro de `<DJO>`).
3. **Datos de aprobación del FH** (`djo-exportador-signed-eh.xml`): se agregan `<EH>` (datos de la entidad) y `<ApprovalEH>` (`ApprovalNumber`, `ApprovalDate`, `ROMCompliance`) como **hermanos de `<DJOExporter>`**, dentro de `<DJOEH>` — fuera del subárbol `<DJO>` ya firmado.
4. **Firma del FH** (`djo-exportador-signed-eh-signed.xml`): segundo `<ds:Signature>`, con `Reference URI="#DJOEH"`, como hermano de `<DJOExporter>`/`<EH>`/`<ApprovalEH>` dentro de `<DJOEH>` — cubre todo el documento, incluida la firma del EXP.

**Por qué no rompe la firma del EXP**: el digest de la firma del EXP se calcula solo sobre `#DJO` (el contenido de `<DJO id="DJO">`). El FH agrega `<EH>`/`<ApprovalEH>` como hermanos posteriores, **fuera** de ese subárbol, así que ni un byte de lo que el EXP firmó cambia. La firma del FH sí cubre todo (`#DJOEH`), notariando el documento completo incluida la firma del EXP como dato dentro de lo firmado. Mecánicamente es un calco de COD.

### Estructura real completa del XML

```
<ns1:Envelope xmlns:ns1="...soap-envelope">
  <ns1:Affidavit>
    <DJOEH id="DJOEH">
      <DJOExporter>
        <DJO id="DJO">
          <DJOVer>1.0.0</DJOVer>
          <DJOSubmitterType>EXP</DJOSubmitterType>
          <Agreement><AgreementAcronym>...</AgreementAcronym><OriginRule>...</OriginRule></Agreement>
          <Exporter>...</Exporter>
          <Producer>...</Producer>
          <Declaration><DeclarationDate>...</DeclarationDate></Declaration>
          <FormDJO>
            <GoodName>...</GoodName> <!-- producto único, no lista de mercaderías como COD -->
            <GoodVariant>...</GoodVariant> <!-- variantes del mismo producto, ver sección 9 -->
            <ManufacturingProcess>...</ManufacturingProcess>
            <Components>
              <LocalSupplies>...</LocalSupplies>
              <IntrazoneSupplies>...</IntrazoneSupplies>
              <ExtrazoneSupplies>...</ExtrazoneSupplies>
              <PACThirdCountrySupplies>...</PACThirdCountrySupplies>
            </Components>
          </FormDJO>
        </DJO>
        <ds:Signature>...<ds:Reference URI="#DJO">...</ds:Signature>   <!-- Firma EXP -->
      </DJOExporter>
      <EH>...</EH>
      <ApprovalEH>...</ApprovalEH>
    </DJOEH>
    <ds:Signature>...<ds:Reference URI="#DJOEH">...</ds:Signature>     <!-- Firma FH -->
  </ns1:Affidavit>
</ns1:Envelope>
```

**Importante para quien lea/extraiga datos de este XML**: la app usa `document.querySelector('NombreDeTag')` para leer casi todos los campos, agnóstico a la profundidad de anidamiento — ver sección 9.

## 3. Versiones de DJO y elementos permitidos

Versiones vigentes hoy: **1.0.0 y 2.0.0**, ambas indefinidamente (confirmado por el dueño del proyecto, 2026-09-04) — **no** es una migración donde 2.0.0 reemplace a 1.0.0, un emisor puede seguir usando cualquiera de las dos. No hay "familias" de versiones ni normalización — la app lee `<DJOVer>` tal cual y lo compara contra `KNOWN_DJO_VERSIONS` (`src/lib/djo-spec.js`).

**Regla central (confirmada por el dueño del proyecto, 2026-09-04)**: una DJO puede omitir o dejar vacío cualquier campo definido para su versión, pero **nunca** puede traer un elemento no enumerado para esa versión. `ALLOWED_ELEMENTS_BY_VERSION['1.0.0']`/`['2.0.0']` (`src/lib/djo-spec.js`) son la lista completa de cada una; `getUnknownElements()` la recorre y reporta cualquier tag fuera de esa lista, ignorando la firma digital (namespace XMLDSig) y el sobre SOAP raíz (`ns1:Envelope`/`ns1:Affidavit`, protocolo de transporte, no contenido de la DJO).

**Por qué no es un XSD**: se evaluaron ambos enfoques (XSD por versión vs. función interna) y se eligió la función interna — más simple de mantener a mano, y la forma real de `<GoodVariant>` (varios ítems como hermanos planos sin wrapper por ítem, ver sección 9) es incómoda de expresar en un XSD estricto.

### Qué cambia en v2.0.0 (confirmado con un ejemplo real, 2026-09-04)

`<Agreement>` pasa de **único** (v1.0.0) a **repetible** (v2.0.0) — una DJO puede declararse simultáneamente bajo varios acuerdos comerciales, cada uno con su propia norma de origen y su propia clasificación arancelaria (porque el mismo producto puede tener un código distinto según el sistema/revisión de nomenclatura de cada acuerdo — ej. NCM 2022 vs. NALADISA 2016 clasificando el mismo café con códigos diferentes).

| | v1.0.0 | v2.0.0 |
|---|---|---|
| `<Agreement>` | Único | Repetible — uno por acuerdo, cada bloque **autocontenido** (no son hermanos planos como `<GoodVariant>`; cada `<Agreement>...</Agreement>` trae sus propios hijos, así que `querySelectorAll('Agreement')` alcanza sin ningún truco) |
| Cantidad declarada | — (implícita, siempre 1) | `<AgreementQty>`, hermano de `<DJOSubmitterType>`, antes del primer `<Agreement>` |
| Campos dentro de `<Agreement>` | `AgreementAcronym`, `OriginRule` | Los mismos, más `NomenclatureType` (ej. `NCM`, `NALADISA`), `NomenclatureRev` (ej. `2022`), `AgreementNomenclatureCode` (el código arancelario según ese acuerdo/nomenclatura específico) |

Todo lo demás del documento (Exporter, Producer, FormDJO con sus variantes y los 4 grupos de `Components`, EH, ApprovalEH) es **idéntico** entre v1.0.0 y v2.0.0.

**Importante — esta es la primera vez que `DJOVer` determina la ESTRUCTURA del documento, no solo la whitelist**: `DJOViewer.jsx` y `pdf-generator.js` ramifican explícitamente por `DJOVer === '2.0.0'` para decidir si renderizan "Acuerdo comercial" (una sección) o "Acuerdos comerciales" (una por cada `<Agreement>`, con la cantidad declarada mostrada primero). Esto **no contradice** la sección 4 (el *valor* del acuerdo sigue sin determinar ningún requerimiento de campo) — son dos ejes distintos: *qué acuerdo es* sigue siendo puramente informativo; *qué versión de DJO es* ahora sí determina la forma de esa sección. Cualquier versión futura que agregue una diferencia estructural similar debe seguir este mismo patrón (branch explícito por `DJOVer`, con un valor por defecto — la forma de v1.0.0 — para cualquier versión no reconocida).

**Versiones futuras**: cuando aparezca una nueva versión, agregar su entrada a `ALLOWED_ELEMENTS_BY_VERSION` y a `KNOWN_DJO_VERSIONS`, y evaluar si además hace falta una rama de renderizado nueva (como la de arriba) o si sus campos encajan en la forma ya existente.

## 4. El Acuerdo comercial es meramente informativo

`<AgreementAcronym>` existe como campo (y su presencia se valida), pero **ningún campo, validación o etapa depende de su valor** (confirmado por el dueño del proyecto, 2026-09-04). Esto es una diferencia fundamental con COD, donde el acuerdo determina el formulario aplicable y una tabla completa de requerimientos M/O/NC por acuerdo (`AGREEMENT_MAPPING` en `cod-spec.js` de COD-Viewer).

**No portar el patrón de COD-Viewer de requerimientos de campo por acuerdo** — no existe para DJO, no es un gap a llenar, es una diferencia de diseño permanente.

## 5. Todo campo de la versión se muestra siempre

A diferencia de COD-Viewer (que oculta campos marcados "No corresponde" según versión+acuerdo), en DJO **todo campo definido para la versión se muestra siempre en pantalla, tenga o no contenido** (confirmado por el dueño del proyecto: la validación de contenido la hace un Funcionario Habilitado de forma visual, así que ocultar un campo vacío le ocultaría justamente lo que necesita revisar).

`DJOViewer.jsx` ya cumple esto de fábrica: nunca oculta condicionalmente un `Field`, solo lo marca `required` (ícono ámbar) u `optional` (ícono gris) — ambos siempre visibles. **No portar el patrón `shouldShowField()`/ocultamiento por NC de COD-Viewer.**

## 6. Validaciones sobre el archivo XML de entrada

Implementadas en `src/lib/input-validation.js`, corridas desde `processXML()` en `DJOViewer.jsx` y mostradas vía `InputValidationAlert`.

| Validación | Qué chequea | Bloquea o advierte |
|---|---|---|
| `<DJOVer>` presente | Que exista ese elemento | Advierte |
| `<DJOVer>` reconocida | Que sea una de `KNOWN_DJO_VERSIONS` (sección 3) | Advierte |
| Elementos permitidos por versión | Que no haya tags fuera de `ALLOWED_ELEMENTS_BY_VERSION` (sección 3) — solo se chequea si la versión sí es reconocida, para no inundar de falsos positivos un documento cuya versión no se pudo identificar | Advierte |
| `<AgreementAcronym>` presente | Que exista (no se valida su valor, ver sección 4) | Advierte |
| `<DJO id="DJO">` / `<DJOEH id="DJOEH">` presentes | Estructura básica mínima de una DJO | Advierte |
| Codificación del prólogo XML | Que el `encoding="..."` declarado sea UTF-8 | Advierte |
| Caracteres de reemplazo (`�`, U+FFFD) | Que no aparezcan en el contenido decodificado — señal de que la codificación real no era UTF-8 aunque el prólogo no lo declare mal | Advierte |
| Tamaño del archivo | Que no supere 4 MB | **Bloquea** |
| BOM (Byte Order Mark) | Que el archivo no empiece con U+FEFF | Advierte |

**Camino por URL (`?xmlUri=`)**: el proxy (`src/app/api/proxy/route.js`) además valida el `Content-Type` de la respuesta remota — rechaza explícitamente `html`, `json`, `image/*`, `video/*`, `audio/*`, `pdf` antes de intentar parsear el cuerpo como XML.

**Todas las validaciones de esta tabla son advertencias, con una única excepción (el tamaño)** — el resto del contenido se sigue mostrando siempre.

### Tamaño máximo (4 MB) — bloqueante

`validateSize()` rechaza directamente un archivo de más de 4 MB, tanto en la carga por archivo (sobre `file.size`, antes de leer el contenido) como en el proxy (cortando la lectura del cuerpo remoto en el momento en que se supera el límite — no alcanza con mirar `Content-Length`, que puede faltar o venir mal informado). Es una protección de recursos, no una regla de negocio de DJO — por eso es la única que bloquea.

### BOM — advertencia, no bloqueo

`validateBOM()`/`decodeXmlBytes()` detectan el BOM explícitamente: se decodifica con `TextDecoder('utf-8', { ignoreBOM: true })` (el modo por defecto lo quita en silencio, que es justo lo que no queremos), se revisa el primer carácter decodificado, y si hay BOM se lo quita del contenido antes de seguir procesando pero se avisa al usuario. Para que esta detección sobreviva el viaje por `/api/proxy` (camino `?xmlUri=`), el proxy pasa el cuerpo remoto tal cual, en bytes crudos, sin decodificar/reencodear como texto.

## 7. Firmas digitales

Implementado en `src/components/signature-utils.js` (`verifySignatureForElement`, `getSignatureStatusDisplay`, `checkSignatureIntegrity`) + `src/app/api/verify-signature-integrity/route.js`.

### Qué verifica (y qué NO verifica)

**Sí verifica:**
- Presencia de un `<ds:Signature>` cuyo `<ds:Reference URI="#DJO">` o `="#DJOEH"` matchee el elemento buscado.
- Algoritmo de **firma** real (`SignatureMethod`, ej. `rsa-sha256`) — no solo el de **digest** (`DigestMethod`). Marca como "débil/obsoleto" cualquier algoritmo con `sha1` o `md5` en el nombre.
- **Vigencia del certificado X.509** (`NotBefore`/`NotAfter`), extraída con un parser ASN.1/DER mínimo escrito a mano — ver `getCertificateValidity()`.
- **Firmas duplicadas**: más de un `<ds:Signature>` con la misma `Reference URI`.
- **Integridad criptográfica de la firma**: que el contenido firmado no haya sido modificado después de firmarlo. Recalcula el digest del contenido referenciado (aplicando la canonicalización XML y el transform `enveloped-signature` que declara la propia firma) y lo compara contra `<DigestValue>`, y verifica `<SignatureValue>` contra `<SignedInfo>` usando la clave pública del certificado embebido (`<X509Certificate>`).

**No verifica (y lo dice explícitamente en el texto que muestra):**
- La cadena de confianza del certificado (no valida contra una Autoridad Certificante raíz).
- Si el certificado estaba revocado en el momento de la firma — no consulta ninguna CRL/OCSP. Solo determina si la fecha de la firma caía dentro del período de vigencia del certificado. Sugiere usar otra herramienta (ej. S-FiDE) para esa validación.

### Por qué corre server-side

La verificación real de XMLDSig requiere canonicalización XML (C14N), sin equivalente nativo en el navegador. Se usa `xml-crypto` (que sí implementa C14N, apoyado en Node `crypto`) desde `POST /api/verify-signature-integrity`, que recibe el XML crudo y devuelve `{ DJO: {integrityValid}, DJOEH: {integrityValid} }`. Se llama **una sola vez por documento cargado** (no por cada firma).

### Vigencia comparada contra la fecha real de la firma, NUNCA contra "hoy"

| Firma | Elemento | Fecha de referencia para chequear vigencia |
|---|---|---|
| Exportador (EXP) | `#DJO` | `<DeclarationDate>` |
| Funcionario Habilitado (FH) | `#DJOEH` | `<ApprovalDate>` |

Si se comparara contra la fecha de hoy, cualquier DJO de más de ~2 años (vigencia típica de un certificado de firma digital en Argentina) siempre aparecería "vencida", aunque haya sido válida al firmarse — dato inútil y engañoso.

### Fechas en UTC explícito

`DeclarationDate`/`ApprovalDate` llegan sin offset de zona horaria (ej. `"2025-04-28T00:00:00"`). Se parsean y se muestran explícitamente en UTC, para que coincidan con las fechas del certificado X.509 (que sí son UTC/Zulu) sin importar la zona horaria del navegador o servidor.

### Severidad visual (3 niveles)

| Color | Cuándo |
|---|---|
| Azul | Firma presente, sin ninguna advertencia. |
| Ámbar | Algoritmo de firma débil (SHA-1/MD5), o firmas duplicadas. |
| **Rojo** | El certificado no estaba vigente en la fecha de esa firma, **o** la integridad (`integrityValid === false`) detectó que el documento fue modificado después de firmarlo. |

Falta de firma (`hasSignature: false`) se muestra en ámbar — es el estado normal de una DJO en proceso (ver sección 8), no una anomalía en sí misma.

## 8. Etapa de emisión detectada por la app

`getEmissionStage(xmlDoc)` (`src/components/signature-utils.js`) interpreta la combinación de firmas/datos presentes según el mecanismo de la sección 2:

| Etapa | Condición | Significado |
|---|---|---|
| 1 | Sin firma `#DJO` y sin `<EH>`/`<ApprovalEH>` | Borrador — sin firmar |
| 2 | Firma `#DJO` presente, sin `<EH>`/`<ApprovalEH>` | Firmado por el Exportador, pendiente de verificación por la EH |
| 3 | Firma `#DJO` + `<EH>`/`<ApprovalEH>` presentes, sin firma `#DJOEH` | Verificado por la EH, pendiente de firma del FH |
| 4 | Ambas firmas presentes | DJO completa |
| "anómalo" | Cualquier combinación que no encaje (ej. `#DJOEH` firmado sin `#DJO` firmado, o `<EH>`/`<ApprovalEH>` presentes sin `#DJO` firmado) | Inconsistencia — no debería poder pasar según el mecanismo |

**Confirmado por el dueño del proyecto (2026-09-04)**: el caso de `<EH>`/`<ApprovalEH>` con datos completos pero **sin ninguna firma** (visto en las DJO de ejemplo `djo-ejemplo-1-sin-firmas.xml`/`djo-ejemplo-2-sin-firmas.xml`) es genuinamente el caso "anómalo" — no una categoría de referencia válida aparte.

Se muestra vía `EmissionStageAlert` (roja, arriba de todo) cuando la etapa no es la 4, **sin ocultar el resto del contenido** — alguien revisando una DJO en proceso necesita ver los datos ya cargados.

## 9. Estructura del XML real vs. jerarquía visual

Toda la extracción de datos usa `xmlData.querySelector('NombreDeTag')`, que busca por nombre de tag en **todo el subárbol sin importar la profundidad** — no importa si `ExporterCountry` está 2 o 5 niveles adentro, se encuentra igual. Por eso la jerarquía visual (`level` del componente `Section`) puede ser más superficial que el XML real y no es un problema.

**Caso particular — `<GoodVariant>`**: a diferencia de una lista con un wrapper por ítem, las variantes de un mismo producto aparecen como **elementos hermanos planos** dentro de un único `<GoodVariant>` (ej. `GoodVariantItem`, `GoodVariantName`, `GoodVariantExporterCode`, `GoodVariantDescription` de la variante 1, seguidos por los mismos 4 tags de la variante 2, y así). `DJOViewer.jsx` los separa localizando los límites entre `<GoodVariantItem>` consecutivos sobre el `innerHTML` del contenedor (no hay forma limpia de usar `querySelectorAll` posicional para esto). Es el motivo por el que la whitelist de elementos (sección 3) no distingue "variante 1" de "variante 2" — son los mismos 4 nombres de tag repetidos.

**Las 6 secciones repetibles muestran su cantidad declarada, no solo la real** (`AgreementQty`, `GoodVariantQty`, `LocalSuppliesQty`, `IntrazoneSuppliesQty`, `ExtrazoneSuppliesQty`, `PACThirdCountrySuppliesQty` — confirmado 2026-09-04): cada una de estas secciones muestra un `Field`/`addField` explícito con el valor literal del tag `*Qty`, además del badge de conteo del título de sección (que refleja cuántos ítems hay **realmente** en el XML, vía `.length`). Son dos fuentes de verdad distintas a propósito — si algún día no coinciden (la DJO declara `GoodVariantQty=5` pero solo trae 3 `<GoodVariantItem>`, por ejemplo), el desfasaje queda visible a simple vista en vez de quedar oculto. Si se agrega una sección repetible nueva en una versión futura, aplicar el mismo criterio.

## 10. El PDF exportado

Generado con `jsPDF` puro (sin `jspdf-autotable`: COD-Viewer lo tiene instalado pero no lo usa en ningún lado de su generador, así que DJO-Viewer no arrastra esa dependencia) — misma lógica de negocio que la vista web, reutilizando `src/components/signature-utils.js` sin duplicar la interpretación de firmas/etapa de emisión entre los dos.

| Característica | Valor |
|---|---|
| Tamaño de página | A4 (210×297mm), orientación vertical |
| Compresión | Activada (`compress: true`) |
| Autor (metadata) | `Grupo Sauken S.A. - ARGENTINA` |
| Creador (metadata) | `Visualizador DJO` |
| Nombre de archivo | `DJO_<ApprovalNumber>_<fecha>.pdf` (usa `<ApprovalNumber>` — "Número DJO" en la vista web — como identificador; si no está presente, `DJO_DJO_<fecha>.pdf`) |
| Versión de la app visible | Pie de página de cada hoja, discreta, igual que en la vista web |

**Estructura**: calca el orden y los campos de `DJOViewer.jsx` sección por sección (información general, acuerdo(s), exportador, productor, producto y sus variantes, proceso de fabricación, los 4 grupos de materiales, declaración, EH, verificación) — no hay una tabla de datos separada que mantener sincronizada con la vista web. La sección de acuerdo(s) rama igual que la vista web según `DJOVer` (ver sección 3) — `renderAgreement()` en `pdf-generator.js` dibuja un bloque por cada `<Agreement>` en v2.0.0, precedido por el campo "Cantidad de acuerdos" (`AgreementQty`); en v1.0.0 sigue siendo una única sección "Acuerdo comercial".

**Resaltado de campos — diferencia deliberada con COD-Viewer**: cada campo se pinta ámbar (obligatorio) o gris (opcional), igual que los íconos de `<Field>` en la vista web. **A diferencia de COD-Viewer, el PDF de DJO no resalta en rojo un campo obligatorio que esté vacío** — es la misma decisión que ya regía para el componente `<Field>` de la vista web (sección 12), aplicada acá para que el PDF y la pantalla muestren siempre la misma información con la misma severidad visual; un campo vacío se ve simplemente como "No especificado" dentro de su caja ámbar u gris.

**Alertas incluidas, mismo texto que sus contrapartes de la vista web**: advertencias de validación de entrada (`InputValidationAlert` — incluye los elementos no definidos para la versión, sección 3, ya que viajan en el mismo arreglo de warnings) y etapa de emisión (`EmissionStageAlert`, con marca de agua diagonal "EN PROCESO — NO VÁLIDO" en todas las páginas cuando la DJO no está completa). **No hay alerta de "elementos inesperados" ni de validación XSD** — ninguna de las dos existe en DJO-Viewer (secciones 4 y 12).

## 11. Decisiones de seguridad deliberadas

- **El proxy (`/api/proxy`) no tiene allowlist de host ni de esquema, a propósito**: las DJO pueden estar alojadas en cualquier red, interna o externa, según el emisor. Esto está documentado con un comentario en el propio código para que no se "corrija" por error en el futuro.
- El proxy sí valida `Content-Type` de la respuesta remota (sección 6) y el código HTTP (`response.ok`) — pero no restringe a qué *host* se puede apuntar.
- **`next.config.js` no agrega headers CORS globales** — se removieron (v1.1.0) porque no aportaban nada al caso de uso real (la carga por `?xmlUri=` ya funciona vía el proxy, server-to-server, nunca sujeto a CORS) y solo ampliaban la superficie de abuso tipo SSRF.
- **Cadena de confianza del certificado y revocación (OCSP/CRL): NO SOPORTADO, decisión permanente, no una tarea pendiente** — mismo criterio que adoptó COD-Viewer.

## 12. Deuda conocida / pendiente explícito

- **`Field` sin resaltado de error** (`hasError`) para un campo obligatorio faltante, tanto en la vista web como en el PDF (sección 10) — dejado tal cual a pedido explícito del dueño del proyecto (2026-09-04).
- **No aplican a DJO, no son deuda**: la tabla M/O/NC por acuerdo y la validación contra un XSD oficial externo — ninguna de las dos tiene sentido para DJO dado que no hay acuerdo-dependencia (sección 4) ni regulador externo (sección 1). Si en el futuro se quiere una validación de esquema, sería contra un XSD propio de Sauken, no una adaptación del de ALADI.
