# Guía de examen: qué cambia y por qué en tu app de reservas

> Esta guía sirve para estudiar rápido. No trae el proyecto completo; solo explica **qué tocarías**, **por qué** y **qué lógica seguirías** si te piden un cambio sobre la app que ya tienes.

## Idea principal del proyecto

- `server.js` guarda el estado real de los asientos.
- `public/script.js` pinta la vista del cliente.
- `public/admin.js` pinta la vista del administrador.
- Socket.IO sincroniza los cambios entre pestañas y usuarios.

---

## 1) Sincronización en tiempo real

### Qué te pueden pedir
Que si un usuario reserva o compra un asiento, todos lo vean al instante.

### Qué tocarías
- `server.js`
- `public/script.js`

### Lógica
1. El cliente manda una intención: `reserve`, `release` o `buy`.
2. El servidor cambia el estado real.
3. El servidor emite `seatUpdated` para que todos repinten.

### Por qué
Porque el DOM del navegador no puede ser la verdad; la verdad debe vivir en el servidor.

### Bloque mental
```js
// server.js
io.emit('seatUpdated', { seatId, seat: seats[seatId] });

// public/script.js
socket.on('seatUpdated', ({ seatId, seat }) => {
  seatsState[seatId] = seat;
  paintSeat(seatId);
});
```

---

## 2) Estado inicial al entrar tarde o reconectar

### Qué te pueden pedir
Que un cliente nuevo vea los asientos ya reservados o vendidos.

### Qué tocarías
- `server.js`
- `public/script.js`

### Lógica
Al conectar, el servidor manda un `init` con todo el objeto `seats`.
El cliente lo guarda y repinta todos los asientos.

### Por qué
Porque si solo escuchas eventos futuros, llegas tarde y no sabes qué pasó antes.

### Bloque mental
```js
socket.emit('init', { seats, pricing: PRICING_BY_ROW });

socket.on('init', ({ seats, pricing }) => {
  seatsState = seats;
  pricingByRow = pricing;
  paintAll();
});
```

---

## 3) Expiración automática de reservas

### Qué te pueden pedir
Que una reserva dure solo un tiempo y luego se libere.

### Qué tocarías
- `server.js`
- `public/script.js`

### Lógica
Cuando reservas, el servidor guarda `expiresAt` y programa un `setTimeout`.
Si al vencer sigue reservado por esa misma reserva, se libera.

### Por qué
Porque el tiempo debe controlarlo el servidor, no el navegador.

### Bloque mental
```js
seat.expiresAt = Date.now() + RESERVATION_MS;

setTimeout(() => {
  if (seats[seatId].status === 'reserved' && seats[seatId].expiresAt === expectedExpiry) {
    seats[seatId].status = 'available';
  }
}, RESERVATION_MS);
```

---

## 4) Evitar doble reserva

### Qué te pueden pedir
Que dos usuarios no reserven el mismo asiento al mismo tiempo.

### Qué tocarías
- `server.js`

### Lógica
Antes de reservar, el servidor revisa si el asiento está `available`.
Si no lo está, no hace nada.

### Por qué
Porque dos clicks casi simultáneos pueden causar conflicto y solo el servidor debe decidir.

### Bloque mental
```js
if (seat && seat.status === 'available') {
  seat.status = 'reserved';
  seat.user = username;
}
```

---

## 5) Validar compra

### Qué te pueden pedir
Que solo se pueda comprar lo que el mismo usuario reservó.

### Qué tocarías
- `server.js`
- `public/script.js`

### Lógica
Al recibir `buy`, el servidor revisa asiento por asiento:
- que esté reservado
- que pertenezca al mismo `username`

### Por qué
Porque el cliente no es confiable.

### Bloque mental
```js
if (!seat || seat.status !== 'reserved' || seat.user !== username) {
  return;
}
seat.status = 'sold';
```

---

## 6) Liberación manual visible para todos

### Qué te pueden pedir
Que si un usuario suelta un asiento, se vea libre en todas las pestañas.

### Qué tocarías
- `server.js`
- `public/script.js`

### Lógica
El cliente manda `release`.
El servidor valida que ese asiento sea de ese usuario.
Luego cambia el estado y emite `seatUpdated`.

### Por qué
Porque si solo cambias la interfaz local, los demás siguen viendo datos viejos.

---

## 7) Mostrar el nombre del usuario sobre el asiento

### Qué te pueden pedir
Que al pasar el mouse o ver el asiento, aparezca quién lo reservó o compró.

### Qué tocarías
- `public/script.js`
- `public/styles.css`

### Lógica
Usas `seat.user` para pintar:
- `Res: nombre` si está reservado
- `Vend: nombre` si está vendido

### Por qué
Porque hace la interfaz más clara y útil.

---

## 8) Precio por fila

### Qué te pueden pedir
Que A valga distinto de B y C.

### Qué tocarías
- `server.js`
- `public/script.js`

### Lógica
Creas una tabla de precios por fila:
```js
const PRICING_BY_ROW = { A: 6, B: 5, C: 4 };
```
Cuando construyes cada asiento, le asignas su precio.

### Por qué
Porque así el precio queda centralizado y fácil de cambiar.

---

## 9) Calcular el total seleccionado

### Qué te pueden pedir
Que el sistema muestre cuánto cuestan los asientos elegidos.

### Qué tocarías
- `public/script.js`
- `public/index.html`

### Lógica
Recorres `selectedSeats`, sumas `seat.price` y actualizas el total.

### Por qué
Porque el usuario necesita ver el monto antes de comprar.

---

## 11) Panel de administrador

### Qué te pueden pedir
Que exista una vista aparte para ver el estado global.

### Qué tocarías
- `public/admin.html`
- `public/admin.js`
- `server.js`

### Lógica
El admin recibe el mismo estado, pero puede ver:
- disponibles
- reservados
- vendidos

Y además puede ejecutar acciones globales como:
- liberar reservas
- resetear asientos

### Por qué
Porque el admin necesita supervisar todo sin usar la vista normal.

---

## 20) Comentarios y explicación del código

### Qué te pueden pedir
Que expliques o comentes bien el proyecto.

### Qué tocarías
- todo el proyecto, sobre todo `server.js` y `public/script.js`

### Lógica
Los comentarios deben decir:
- qué hace el bloque
- por qué existe
- qué regla aplica

### Por qué
Porque en examen importa demostrar que entiendes la intención del código.

### Ejemplo bueno
```js
// El servidor valida el estado real antes de reservar para evitar doble reserva.
```

---

# Resumen corto para memorizar

## Si te preguntan por concurrencia
- sincronización
- estado inicial
- evitar doble reserva
- validar compra

## Si te preguntan por interfaz
- usuario sobre asiento
- precio por fila
- total
- mini factura

## Si te preguntan por control
- panel admin
- liberar reservas
- resetear asientos

## Frase para defensa oral
> "El servidor guarda el estado real y Socket.IO solo sincroniza los cambios a los clientes. Así evito inconsistencias y cualquier nueva vista se puede reconstruir a partir del snapshot inicial." 

