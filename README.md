# Lab2 WebSockets - Reserva de asientos

Aplicación de ejemplo con `Express + Socket.IO` para reservar y comprar asientos en tiempo real.

## Qué hace la app

- Sincroniza reservas y compras entre varias pestañas/usuarios.
- Envía el estado inicial completo cuando entra un cliente nuevo.
- Reserva con expiración automática de 60 segundos.
- Evita doble reserva en el servidor.
- Valida que solo se compren asientos reservados por el mismo usuario.
- Muestra el nombre del usuario sobre el asiento y también en tooltip.
- Usa precios por fila:
  - Fila A: $6
  - Fila B: $5
  - Fila C: $4
- Calcula el total seleccionado y muestra una mini factura antes de comprar.
- Incluye un panel de administrador con:
  - vista global de estados,
  - botón para liberar todas las reservas,
  - botón para resetear todos los asientos.

## Cambios / arreglos que ya están aplicados

- El servidor es la fuente de verdad del estado.
- Se corrigen eventos entre cliente y servidor para que coincidan.
- La UI del cliente se repinta cuando llega un cambio por Socket.IO.
- El panel admin recibe snapshots completos del estado.
- El código quedó más compacto y más fácil de leer para examen.

## Archivos principales

- `server.js` → lógica del servidor y estado global.
- `public/script.js` → interfaz del cliente.
- `public/admin.js` → interfaz del administrador.
- `public/index.html` → vista del cliente.
- `public/admin.html` → vista del administrador.

## Ejecución

```bash
npm install
npm start
```

Luego abre:

- Cliente: `http://localhost:2244`
- Admin: `http://localhost:2244/admin.html`

## Notas técnicas

- El estado se guarda en memoria del servidor (`server.js`).
- Si reinicias el proceso, los asientos vuelven al estado inicial.
- Las reservas vencen automáticamente si no se compran.

