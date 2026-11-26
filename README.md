# Peptiva Store

Tienda de peptivasupplies.com migrada de WordPress/WooCommerce a stack propio.

**Stack:** React + Vite + tRPC + Drizzle ORM + MySQL (Railway), Cloudflare R2 para media, Resend para emails.

## Desarrollo

```bash
npm install
cp .env.example .env   # poner DATABASE_URL
npm run dev            # API en :3001, web en :5173
```

## Base de datos

- Las migraciones están en `/drizzle` y **se aplican solas al arrancar el servidor**.
- Para cambiar el esquema: editar `server/db/schema.ts` → `npm run db:generate` → commitear el SQL generado.
- **No usar `drizzle-kit push`.**
- En el primer arranque (tabla de productos vacía) se carga el catálogo de `server/data/catalog.json`, exportado de WooCommerce. `npm run db:seed` solo agrega productos nuevos, nunca sobrescribe.

## Railway

- Build: `npm run build` · Start: `npm start`
- Variables: `DATABASE_URL=${{MySQL.MYSQL_URL}}`

## Admin

`/admin` — pedidos y seguimiento, carritos abandonados, cupones, afiliados, comisiones, mensajes y ajustes.
El administrador se crea al arrancar con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 10 caracteres). Si esas variables cambian, en el siguiente arranque se aplican de nuevo: así se cambia o se recupera la contraseña. Mientras no cambien, se respeta la que se haya puesto desde Settings.

## Afiliados

- Enlace: cualquier URL con `?ref=CODIGO` (también acepta `?aff=`, el parámetro de SliceWP).
- Atribución: cupón del afiliado > enlace (ventana configurable, 30 días por defecto). Sin auto-referidos.
- Comisión: se crea al pagarse el pedido, se aprueba al marcarlo Delivered y se rechaza si se cancela o reembolsa.
- Portal: `/affiliate-account`.

## Tareas programadas

Cada 5 minutos el servidor envía los recordatorios de carritos abandonados (requiere Resend).

## Pagos (Bankful, página de pago alojada)

El cliente paga en la página de Bankful; la tienda no ve ni guarda datos de tarjeta. Variables:

- `BANKFUL_API_USERNAME` y `BANKFUL_API_PASSWORD`: las credenciales de la API. La contraseña firma cada petición.
- `BANKFUL_SANDBOX=true`: solo para pruebas, apunta al entorno de pruebas de Bankful. Se quita al pasar a producción.

En el admin, **Settings → Card payments (Bankful)** muestra el modo (sin configurar, pruebas o real) y tiene un botón **Test connection** que comprueba las credenciales sin cobrar nada. Un pedido solo se marca como pagado con una respuesta firmada por Bankful con estado `APPROVED` y por el importe del pedido; cualquier otra cosa queda en revisión manual.
