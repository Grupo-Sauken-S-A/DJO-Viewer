# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Corregido

- `npm run lint` fallaba porque usaba `next lint`, comando removido del CLI de Next.js en la v16. Ahora corre `eslint .` con config plana propia (`eslint.config.mjs`) basada en `eslint-config-next/core-web-vitals`.

## [1.0.0] - 2026-09-02

### Agregado

- Primera versión publicada del repositorio, migrada desde el servidor de producción (openSUSE Tumbleweed) al entorno de desarrollo actual.
- Visualizador de Declaración Jurada de Origen (DJO) Digital: carga manual de XML y carga por URL (`?xmlUri=`) vía proxy server-side.
- Detección de presencia de firmas digitales XMLDSig (sin validación criptográfica).
- Documentación del proyecto: README, AGENTS.md y licencia GPL-2.0.
