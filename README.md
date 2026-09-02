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

- Node.js `>= 20.9.0`

## Desarrollo local

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:3001`.

## Build de producción

```bash
npm run build
npm run start
```

## Cómo funciona la carga por URL

1. El navegador navega a `/?xmlUri=<url-del-xml>` (navegación normal de página, no requiere CORS).
2. El componente cliente llama a `/api/proxy?url=<url-del-xml>`.
3. Esa ruta corre en el servidor y hace `fetch()` del XML, evitando así restricciones de CORS del servidor de origen del archivo, y lo devuelve al navegador como texto XML.
4. El XML se parsea en el navegador con `DOMParser` y se renderiza la estructura del documento.

### Nota de diseño importante

El endpoint `/api/proxy` (ver [src/app/api/proxy/route.js](src/app/api/proxy/route.js)) acepta **cualquier** URL en el parámetro `url`, sin allowlist de dominios, y [next.config.js](next.config.js) agrega `Access-Control-Allow-Origin: *` a todas las rutas. Esto es **intencional**: el objetivo del producto es que cualquier aplicación, en cualquier computadora o red, pueda enlazar un DJO propio para visualizarlo acá, sin que el visualizador dependa de una lista cerrada de proveedores.

Quien despliegue o modifique este proyecto debe tener presente que esto habilita un patrón de proxy abierto (server-side request forgery, SSRF) por diseño. Antes de restringirlo (por ejemplo agregando una allowlist de hosts), confirmar que no rompe el caso de uso principal del producto.

## Firmas digitales

La app detecta la presencia de firmas digitales XMLDSig en el documento (ver [src/components/signature-utils.js](src/components/signature-utils.js)) pero **no valida** su validez criptográfica. Si se requiere validar una firma, debe usarse otra herramienta.

## Estructura del proyecto

```
src/
  app/
    api/proxy/route.js   Proxy server-side para cargar XML por URL
    layout.js            Layout raíz
    page.js              Página principal
    globals.css
  components/
    DJOViewer.jsx         Componente principal: carga y renderiza el DJO
    signature-components.js  Verificación de presencia de firmas digitales
    signature-utils.js       Utilidades XMLDSig
    country-codes.js         Catálogo de países
    ui/                       Componentes de UI reutilizables (Card, Alert, Tabs)
```

## Licencia

Este proyecto está licenciado bajo la [GNU General Public License v2.0](LICENSE).
