# Lab2 WebSockets - Reserva de asientos

Aplicacion de ejemplo con `Express + Socket.IO` para reservar y comprar asientos en tiempo real.

## Funcionalidades

- Sincronizacion en tiempo real entre pestanas/clientes.
- Estado inicial consistente al entrar: disponibles, reservados y vendidos.
- Tooltip y etiqueta visual con el nombre de quien reserva/compra.
- Precios por fila (A: $6, B: $5, C: $4).
- Total dinamico y mini factura previa a la compra.
- Panel de administrador (`/admin.html`) con:
  - contador global de estados,
  - tabla de asientos,
  - accion **Liberar todas las reservas**,
  - accion **Resetear asientos**.

## Ejecucion

```bash
npm install
npm start
```

Luego abre:

- Cliente: `http://localhost:2244`
- Admin: `http://localhost:2244/admin.html`

## Notas tecnicas

- El estado se guarda en memoria del servidor (`server.js`).
- Si el proceso se reinicia, los asientos vuelven al estado inicial.
- Las reservas expiran automaticamente en 60 segundos si no se compran.

