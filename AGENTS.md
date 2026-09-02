# Guía para agentes de IA (Claude Code y otros)

Contexto para cualquier agente que trabaje en este repositorio.

## Qué es este proyecto

Visualizador Next.js de Declaraciones Juradas de Origen (DJO) Digital, para Sauken / Certificados de Origen. Ver [README.md](README.md) para detalles funcionales.

## Reglas importantes, no cambiar sin pedirlo explícitamente el usuario

1. **`src/app/api/proxy/route.js` es un proxy abierto a propósito.** Acepta cualquier URL sin allowlist. Es el mecanismo que permite que cualquier app externa cargue un DJO propio vía `?xmlUri=`. No lo trates como un bug de seguridad a corregir por iniciativa propia (SSRF): ya fue señalado al usuario y decidió mantenerlo así.
2. **`next.config.js` define `Access-Control-Allow-Origin: *`** en todas las rutas, también intencional, por el mismo motivo. No lo restrinjas sin pedirlo el usuario.
3. **No se valida la firma digital XMLDSig**, solo se detecta su presencia (`src/components/signature-utils.js`). Si se pide agregar validación real, es un cambio de alcance grande (verificación criptográfica), no una corrección menor.

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

## Licencia

GPL-2.0 (ver [LICENSE](LICENSE)). Cualquier código nuevo agregado a este repositorio se distribuye bajo los mismos términos.
