# Despliegue en producción

DJO-Viewer corre en el servidor openSUSE Tumbleweed **`sknvm1`** (LAN `192.168.111.3`), como servicio systemd. La terminación TLS y el proxy público **no** están en `sknvm1` — están en un servidor separado, **`sknnuc`**, vía Apache. Este documento describe la topología real (confirmada 2026-09-04) y cómo instalar una versión nueva.

## Topología

| | Valor |
|---|---|
| Servidor de la app | `sknvm1` |
| Directorio | `/djo-viewer` |
| Puerto | `3001` (hardcodeado en `package.json`: `"start": "next start -p 3001"`) |
| Unit de systemd | `/etc/systemd/system/viewdjo.service` |
| Servidor del proxy público (TLS) | `sknnuc` |
| Vhost de Apache | `/etc/apache2/vhosts.d/viewdjo.conf` → `ProxyPass / http://192.168.111.3:3001/` |
| URL pública | `https://viewdjo.certificadoorigen.com.ar/` |

**El vhost de `sknnuc` ya existe y no necesita tocarse** salvo que cambie el puerto o la IP de `sknvm1`. El proyecto hermano COD-Viewer sigue el mismo esquema en `/cod-viewer`, puerto `3000`, `viewcod.certificadoorigen.com.ar`.

## systemd — patrón correcto (no reintroducir el viejo)

```ini
# /etc/systemd/system/viewdjo.service
[Unit]
Description=Website viewdjo.certificadoorigen.com.ar
After=network.target nss-lookup.target time-sync.target remote-fs.target

[Service]
Type=simple
WorkingDirectory=/djo-viewer
ExecStart=/usr/bin/node /djo-viewer/node_modules/.bin/next start -p 3001
Restart=on-failure
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

Corre como `root` (sin `User=`, igual que COD-Viewer en ese mismo servidor — no es algo a "corregir").

**Por qué `ExecStart` invoca `next` directo en vez de `npm run start`**: la unit original (anterior a 2026-09-04, todavía visible en `/etc/systemd/system/viewdjo.service.bak` tras la migración) usaba `Type=forking` + un script wrapper `/usr/local/bin/viewdjo` que hacía `npm run start &` / `npm run stop &`. **`"stop"` nunca estuvo definido en `package.json`** (solo `dev`/`build`/`start`/`lint`/`test`), así que `ExecStop` fallaba en silencio (backgroundeado con `&`, systemd nunca se enteraba), dejando procesos `next-server` huérfanos corriendo para siempre después de cada `systemctl stop`/restart. Se encontró y corrigió el mismo bug primero en COD-Viewer (2026-09-03) y se aplicó el mismo fix acá al hacer la instalación nueva (2026-09-04): `Type=simple` sin ningún `&` de por medio — systemd conoce el PID real y `SIGTERM` le llega directo. Verificado con la prueba definitiva: `systemctl stop viewdjo` → `pgrep -af next-server` da vacío (antes seguía vivo) → `systemctl start viewdjo` levanta de nuevo.

**Si el `package.json` alguna vez cambia el flag de puerto** (`-p 3001` en el script `"start"`), hay que actualizar `ExecStart` a mano — al invocar `next` directamente (no `npm run start`), ese flag no se hereda solo.

El script viejo `/usr/local/bin/viewdjo` y el backup `viewdjo.service.bak` quedan en el servidor sin uso, deliberadamente — no hace falta borrarlos.

## Instalar una versión nueva

```bash
# En sknvm1, como root
cd /
git clone --branch vX.Y.Z https://github.com/Grupo-Sauken-S-A/DJO-Viewer.git djo-viewer-vX.Y.Z
cd djo-viewer-vX.Y.Z
npm ci        # completo — NO --omit=dev, ver nota abajo
npm run build
```

**No usar `npm ci --omit=dev`**: `autoprefixer`/`postcss`/`tailwindcss` son `devDependencies` pero **sí hacen falta durante `next build`** (procesan `globals.css`) — con `--omit=dev` el build falla con `Cannot find module 'autoprefixer'`. `jsdom`/`vitest`/`eslint` (las devDependencies reales de las que sí se podría prescindir en producción) no vale la pena separar del resto; instalar todo con un `npm ci` simple.

Antes de cortar producción, probar en primer plano en un puerto libre:

```bash
PORT=3099 npm start   # o el puerto que esté libre; confirmar con: ss -tlnp | grep :3099
# Ctrl+C para cortar la prueba una vez conforme
```

Si es una actualización (no una instalación nueva), intercambiar directorios en vez de pisar el que está corriendo:

```bash
systemctl stop viewdjo
mv /djo-viewer /djo-viewer-vX.Y.Z-anterior   # no borrar — rollback instantáneo si algo falla
mv /djo-viewer-vX.Y.Z /djo-viewer
systemctl start viewdjo
systemctl status viewdjo   # "active (running)" con UN solo PID
```

**Rollback si algo sale mal:**

```bash
systemctl stop viewdjo
mv /djo-viewer /djo-viewer-vX.Y.Z-broken
mv /djo-viewer-vX.Y.Z-anterior /djo-viewer
systemctl start viewdjo
```

## Verificar

```bash
systemctl status viewdjo                 # active (running), un solo PID
ss -tlnp | grep :3001
curl -s --compressed http://localhost:3001/ | grep -o "DJO-Viewer v[0-9.]*"
```

`curl` **sin** `--compressed` recibe la respuesta gzipeada y `grep` no va a encontrar nada aunque el sitio esté perfectamente sano — no es señal de un problema. La prueba real es la URL pública: `https://viewdjo.certificadoorigen.com.ar/`, confirmando que el pie de página diga la versión esperada.

## Historial

- **2026-09-04**: instalación nueva en `sknvm1` (la anterior estaba sin git, servicio detenido). Se reemplazó `viewdjo.service` con el patrón `Type=simple` (mismo fix aplicado a COD-Viewer un día antes). Ver [CHANGELOG.md](../CHANGELOG.md) v1.2.2 para la versión de código desplegada en ese momento.
