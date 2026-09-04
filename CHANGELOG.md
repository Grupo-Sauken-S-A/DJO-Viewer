# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

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
