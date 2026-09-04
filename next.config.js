/** @type {import('next').NextConfig} */
// Sin bloque headers() con Access-Control-Allow-Origin: "*" a propósito (removido — ver
// CHANGELOG). No tenía ningún efecto sobre la carga de ?xmlUri= de cualquier dominio (eso ya
// funciona vía /api/proxy, un fetch server-to-server que nunca estuvo sujeto a CORS) — solo
// habilitaba que sitios de terceros llamaran a los endpoints de esta app desde el navegador de
// sus propios visitantes. Combinado con que el proxy no tiene allowlist de host a propósito,
// ampliaba la superficie de abuso tipo SSRF sin aportar nada al caso de uso real.
const nextConfig = {}

module.exports = nextConfig
