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
El primer administrador se crea al arrancar con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (solo si no existe ninguno).

## Afiliados

- Enlace: cualquier URL con `?ref=CODIGO` (también acepta `?aff=`, el parámetro de SliceWP).
- Atribución: cupón del afiliado > enlace (ventana configurable, 30 días por defecto). Sin auto-referidos.
- Comisión: se crea al pagarse el pedido, se aprueba al marcarlo Delivered y se rechaza si se cancela o reembolsa.
- Portal: `/affiliate-account`.

## Tareas programadas

Cada 5 minutos el servidor envía los recordatorios de carritos abandonados (requiere Resend).
