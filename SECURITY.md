# Política de seguridad

## Diseño conocido, no es una vulnerabilidad a reportar

El endpoint `/api/proxy` ([src/app/api/proxy/route.js](src/app/api/proxy/route.js)) es un **proxy abierto a propósito**: acepta cualquier URL en el parámetro `url` sin allowlist de host ni de esquema. Esto es intencional — el objetivo del producto es que cualquier aplicación, en cualquier computadora o red, pueda enlazar una DJO propia para visualizarla acá (`?xmlUri=<url>`), sin depender de una lista cerrada de proveedores.

Esto habilita un patrón de tipo SSRF (server-side request forgery) por diseño. Mitigaciones ya implementadas:

- Valida `Content-Type` de la respuesta remota (rechaza `html`/`json`/`image`/`video`/`audio`/`pdf`).
- Corta la lectura del cuerpo remoto si supera 4 MB, sin depender de `Content-Length`.

Si encontrás este comportamiento, **no hace falta reportarlo** — ya está documentado en detalle en [docs/BUSINESS_RULES.md § Decisiones de seguridad deliberadas](docs/BUSINESS_RULES.md#10-decisiones-de-seguridad-deliberadas) y en [AGENTS.md](AGENTS.md). Si tenés dudas sobre el alcance de esta decisión, contactá a Sauken (ver abajo) antes de asumir que es un bug.

## Qué NO valida la app (también por diseño)

- **Cadena de confianza del certificado y revocación (OCSP/CRL)**: la app verifica la integridad criptográfica de una firma XMLDSig (que el contenido no haya sido alterado después de firmarlo) y la vigencia temporal del certificado, pero **nunca** valida contra una Autoridad Certificante raíz ni consulta revocación. Es una decisión permanente, no una limitación temporal — ver [docs/BUSINESS_RULES.md § Firmas digitales](docs/BUSINESS_RULES.md#7-firmas-digitales). Si necesitás esa validación, usá otra herramienta (ej. [S-FiDE](https://github.com/Grupo-Sauken-S-A/S-FIDE)).

## Cómo reportar un problema de seguridad real

Si encontrás un problema de seguridad que **no** sea uno de los puntos de diseño listados arriba (por ejemplo, una forma de ejecutar código arbitrario, exfiltrar datos que la app no debería exponer, o eludir la verificación de integridad de firma), reportalo de forma privada a Grupo Sauken S.A. en **info@sauken.com.ar**, en vez de abrir un issue público.

## Versiones soportadas

Solo se da soporte a la última versión publicada en la rama `main` (ver [releases](https://github.com/Grupo-Sauken-S-A/DJO-Viewer/releases)). No hay versiones LTS ni backports a versiones anteriores.
