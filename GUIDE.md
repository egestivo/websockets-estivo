# Guía de examen: posibles cambios sobre tu app de reservas con Socket.IO

1. [**Sincronización en tiempo real**](#1-sincronización-en-tiempo-real-entre-pestañas--clientes)
2. [**Estado inicial (Snapshot)**](#2-estado-inicial-al-entrar-tarde-o-reconectar)
3. [**Expiración automática (Timers)**](#3-expiración-automática-de-reservas-con-timer)
4. [**Prevención de doble reserva**](#4-evitar-doble-reserva-simultánea)
5. [**Validación de compra**](#5-validar-compra-solo-comprar-asientos-reservados-por-el-mismo-usuario)
6. [**Liberación manual**](#6-liberación-manual-reflejada-en-todos-los-clientes)
7. [**Mostrar nombre de usuario**](#7-mostrar-el-nombre-del-usuario-sobre-el-asiento-reservado-o-vendido)
8. [**Precio por fila**](#8-añadir-precio-por-fila)
9. [**Cálculo de totales**](#9-calcular-el-total-cuando-se-seleccionan-asientos)
10. [**Panel de administrador**](#11-panel-de-administrador)
11. [**Documentación y comentarios**](#20-comentarios-y-documentación-clara-del-flujo)
12. [**Extra: Estrategia de depuración rápida**](#extra-estrategia-de-depuración-rápida)

> Objetivo: esta guía **no** trae el proyecto completo, sino la lógica **exacta** de cómo pensarlo si en el examen te piden cambiar o agregar algo.
>
> Idea central de tu aplicación actual:
> - `server.js` guarda el **estado global**.
> - `public/script.js` pinta la interfaz del cliente.
> - `public/admin.js` controla la vista administrativa.
> - Socket.IO se usa para **sincronizar** cambios entre pestañas/usuarios en tiempo real.

---

## 1) Sincronización en tiempo real entre pestañas / clientes

### Qué te pueden pedir
Que si un usuario reserva o compra un asiento, **los demás lo vean al instante** sin refrescar.

### Qué archivo tocarías
- `server.js`
- `public/script.js`

### Lógica específica
La lógica correcta es que el **servidor sea la fuente de verdad**. Eso significa que:
1. El cliente no decide solo que un asiento quedó reservado.
2. El cliente manda una intención: `reserve`, `release`, `buy`.
3. El servidor cambia el estado real.
4. El servidor emite un evento a todos los clientes con el cambio real.

### Por qué se hace así
Porque si cada pestaña cambia su DOM sola, las demás no se enteran. El servidor debe coordinar para que todos tengan el mismo estado.

### Cómo se piensa el cambio
- Cuando llega una reserva:
  - servidor actualiza `seats[seatId].status`
  - servidor hace `io.emit('seatUpdated', ...)`
- En el cliente:
  - escuchas `seatUpdated`
  - repintas el asiento con su nuevo estado

### Bloque de lógica que normalmente se usaría
```js
// Server: cambia el estado y avisa a todos
io.emit('seatUpdated', { seatId, seat: seats[seatId] });

// Cliente: recibe el cambio y repinta solo ese asiento
socket.on('seatUpdated', ({ seatId, seat }) => {
  seatsState[seatId] = seat;
  renderSeat(seatId);
});
```

### Qué explicar en el examen
> "Se usa Socket.IO para que el servidor propague los cambios a todos los clientes. Así evito inconsistencias entre pestañas." 

---

## 2) Estado inicial al entrar tarde o reconectar

### Qué te pueden pedir
Que un cliente nuevo vea los asientos ya reservados/vendidos aunque entre después.

### Qué archivo tocarías
- `server.js`
- `public/script.js`

### Lógica específica
El servidor debe enviar un **snapshot** del estado actual al conectar un cliente:
- disponibles
- reservados
- vendidos
- usuario que reservó
- precio
- expiración

### Por qué se hace así
Porque un cliente nuevo no conoce la historia previa. Si solo escucha cambios futuros, verá vacío o desactualizado.

### Cómo se piensa el cambio
- En `connection`, el servidor manda `init` con el objeto completo `seats`.
- En el cliente, al recibir `init`, se recorre todo y se pinta cada asiento según su estado.

### Bloque de lógica que normalmente se usaría
```js
// Server: snapshot inicial al conectar
socket.emit('init', { seats, pricing: PRICING_BY_ROW });

// Cliente: reconstruye toda la vista a partir del snapshot
socket.on('init', ({ seats, pricing }) => {
  seatsState = seats;
  pricingByRow = pricing;
  renderAllSeats();
});
```

### Qué explicar en el examen
> "No basta con emitir cambios futuros; al entrar un nuevo cliente se necesita un estado inicial completo para sincronizar su vista." 

---

## 3) Expiración automática de reservas con timer

### Qué te pueden pedir
Que si un asiento se reserva, solo dure un tiempo y luego se libere automáticamente.

### Qué archivo tocarías
- `server.js`
- `public/script.js`

### Lógica específica
La reserva debe tener una marca de tiempo `expiresAt`.
Cuando reservas:
1. el servidor guarda cuándo expira
2. programa un `setTimeout`
3. al vencer, libera el asiento si sigue reservado por esa misma reserva

### Por qué se hace así
Porque el tiempo debe ser controlado por el servidor, no por el navegador del usuario. El cliente puede cerrar, congelarse o manipularse.

### Cómo se piensa el cambio
- Guardar `expiresAt = Date.now() + RESERVATION_MS`
- En el cliente, mostrar la cuenta regresiva
- En el servidor, liberar cuando se cumpla el tiempo

### Bloque de lógica que normalmente se usaría
```js
// Server: guarda expiración
seat.expiresAt = Date.now() + RESERVATION_MS;

// Server: libera si sigue siendo la misma reserva
setTimeout(() => {
  if (seats[seatId].status === 'reserved' && seats[seatId].expiresAt === expectedExpiry) {
    seats[seatId].status = 'available';
  }
}, RESERVATION_MS);
```

### Qué explicar en el examen
> "El servidor controla el vencimiento para que el tiempo sea confiable, y el cliente solo lo muestra visualmente." 

---

## 4) Evitar doble reserva simultánea

### Qué te pueden pedir
Que dos usuarios no puedan reservar el mismo asiento al mismo tiempo.

### Qué archivo tocarías
- `server.js`

### Lógica específica
Antes de reservar, el servidor debe verificar el estado real del asiento:
- si está `available`, lo reserva
- si ya está `reserved` o `sold`, no permite el cambio

### Por qué se hace así
Porque si dos clientes hacen click casi al mismo tiempo, ambos podrían creer que lo lograron. Solo el servidor puede decidir cuál gana.

### Cómo se piensa el cambio
- recibir el `seatId`
- buscar `seats[seatId]`
- comprobar `seat.status === 'available'`
- si no, ignorar la solicitud

### Bloque de lógica que normalmente se usaría
```js
if (seat && seat.status === 'available') {
  seat.status = 'reserved';
  seat.user = username;
} else {
  return;
}
```

### Qué explicar en el examen
> "La prevención de doble reserva se resuelve en el servidor verificando el estado justo antes de modificarlo." 

---

## 5) Validar compra: solo comprar asientos reservados por el mismo usuario

### Qué te pueden pedir
Que no se pueda comprar un asiento que otro usuario reservó o que ya no está válido.

### Qué archivo tocarías
- `server.js`
- `public/script.js`

### Lógica específica
Cuando llega `buy`:
1. el servidor revisa cada asiento
2. confirma que esté `reserved`
3. confirma que el `user` del asiento coincide con `socket.username`
4. solo entonces marca como `sold`

### Por qué se hace así
Porque el cliente no es confiable. El usuario podría intentar comprar un asiento ajeno o uno vencido.

### Cómo se piensa el cambio
- cada asiento del lote se valida uno por uno
- si uno no cumple, no se compra ese asiento
- opcionalmente, si quieres compra atómica, cancelas todo el lote

### Bloque de lógica que normalmente se usaría
```js
if (!seat || seat.status !== 'reserved' || seat.user !== username) {
  return;
}
seat.status = 'sold';
```

### Qué explicar en el examen
> "La compra se valida del lado servidor para asegurar que el asiento realmente pertenece al usuario que intenta comprarlo." 

---

## 6) Liberación manual reflejada en todos los clientes

### Qué te pueden pedir
Que si un usuario deselecciona o libera un asiento, todos lo vean libre inmediatamente.

### Qué archivo tocarías
- `server.js`
- `public/script.js`

### Lógica específica
La liberación manual no debe limitarse al DOM del usuario actual. Debe:
1. actualizar el estado central en servidor
2. emitir un evento a todos
3. limpiar el estado local del cliente que tenía la selección

### Por qué se hace así
Porque si solo cambias el DOM local, el resto de pestañas sigue viendo el asiento reservado.

### Cómo se piensa el cambio
- cliente emite `release`
- servidor valida que el asiento pertenece al usuario
- servidor cambia estado a `available`
- servidor emite `seatUpdated`

### Bloque de lógica que normalmente se usaría
```js
socket.on('release', (seatId) => {
  seats[seatId].status = 'available';
  seats[seatId].user = '';
  io.emit('seatUpdated', { seatId, seat: seats[seatId] });
});
```

### Qué explicar en el examen
> "La liberación también debe propagarse por Socket.IO para que todas las vistas queden consistentes." 

---

## 7) Mostrar el nombre del usuario sobre el asiento reservado o vendido

### Qué te pueden pedir
Que el asiento muestre quién lo reservó o quién lo compró.

### Qué archivo tocarías
- `public/script.js`
- `public/styles.css`
- opcionalmente `server.js` para que envíe `user`

### Lógica específica
Cada asiento ya lleva `user`. El cliente debe usar ese dato para:
- mostrar un texto pequeño sobre el asiento
- poner un `title` o tooltip

### Por qué se hace así
Porque ayuda al usuario a entender de quién es el asiento sin abrir paneles adicionales.

### Cómo se piensa el cambio
- en `renderSeat`, consultar `seat.user`
- si está reservado: mostrar `Res: nombre`
- si está vendido: mostrar `Vend: nombre`
- si está libre: no mostrar nada

### Bloque de lógica que normalmente se usaría
```js
if (seat.status === 'reserved') {
  ownerLabel.textContent = `Res: ${seat.user}`;
  seatElement.title = `Reservado por ${seat.user}`;
}
```

### Qué explicar en el examen
> "El nombre del usuario se muestra como metadato visual para que el estado del asiento sea más legible." 

---

## 8) Añadir precio por fila

### Qué te pueden pedir
Que cada fila tenga un costo diferente, por ejemplo A = 6, B = 5, C = 4.

### Qué archivo tocarías
- `server.js`
- `public/script.js`
- `public/index.html` si quieres mostrar el precio

### Lógica específica
El precio debe venir de una tabla de tarifas, no estar escrito “a mano” en cada asiento.

### Por qué se hace así
Porque si luego cambian las tarifas, solo cambias una estructura central y no todos los asientos por separado.

### Cómo se piensa el cambio
- crear un mapa `PRICING_BY_ROW`
- asignar el precio según la fila al construir el estado inicial
- usar ese precio tanto para mostrar como para calcular totales

### Bloque de lógica que normalmente se usaría
```js
const PRICING_BY_ROW = { A: 6, B: 5, C: 4 };

seats[seatId] = {
  ...,
  price: PRICING_BY_ROW[row]
};
```

### Qué explicar en el examen
> "Los precios se centralizan por fila para facilitar mantenimiento y cambios futuros." 

---

## 9) Calcular el total cuando se seleccionan asientos

### Qué te pueden pedir
Que al seleccionar varios asientos, aparezca el total acumulado.

### Qué archivo tocarías
- `public/script.js`
- `public/index.html`
- `public/styles.css`

### Lógica específica
Cada vez que cambia la selección:
1. recorres `selectedSeats`
2. sumas el precio de cada asiento
3. actualizas el texto del total

### Por qué se hace así
Porque el total debe ser dinámico y coherente con la selección actual del usuario.

### Cómo se piensa el cambio
- usar un `Set` para evitar duplicados
- sumar según `seat.price`
- pintar el total cada vez que cambia la selección

### Bloque de lógica que normalmente se usaría
```js
let total = 0;
selectedSeats.forEach((seatId) => {
  total += seatsState[seatId].price;
});
totalDisplay.textContent = `Total: $${total.toFixed(2)}`;
```

### Qué explicar en el examen
> "El total se calcula en el cliente para feedback inmediato, pero el servidor sigue siendo la fuente real del estado." 

---

## 11) Panel de administrador

### Qué te pueden pedir
Que exista una vista separada para monitorear el estado global.

### Qué archivo tocarías
- `public/admin.html`
- `public/admin.js`
- `server.js`

### Lógica específica
El panel admin no es solo decoración: debe consumir el mismo estado global que el cliente, pero con otra interfaz.

Debe permitir:
- ver asientos disponibles, reservados y vendidos
- contar estados
- ver usuario por asiento
- hacer acciones globales

### Por qué se hace así
Porque un administrador necesita supervisar todo el sistema sin entrar como usuario normal.

### Cómo se piensa el cambio
- crear una vista aparte
- reutilizar los mismos eventos Socket.IO
- añadir botones o filtros de control

### Bloque de lógica que normalmente se usaría
```js
socket.on('init', ({ seats }) => {
  seatsState = seats;
  renderAdminView();
});
```

### Qué explicar en el examen
> "El panel admin reutiliza el mismo estado sincronizado, pero con permisos y acciones diferentes." 

---

## 20) Comentarios y documentación clara del flujo

### Qué te pueden pedir
Que expliques el código o que lo dejes bien comentado para mantenimiento.

### Qué archivo tocarías
- todos, especialmente `server.js` y `public/script.js`

### Lógica específica
No es solo poner comentarios en cualquier parte. Los buenos comentarios explican:
- qué hace cada bloque
- por qué existe
- qué pasa si se modifica
- qué depende de qué

### Por qué se hace así
Porque en un examen, los comentarios ayudan a demostrar que entiendes la arquitectura y la razón de cada decisión.

### Cómo se piensa el cambio
En lugar de comentar lo obvio:
- comenta la intención
- comenta la regla de negocio
- comenta el motivo del evento
- comenta qué cambia si se edita

### Ejemplo de comentario útil
```js
// El servidor valida el estado real antes de reservar para evitar doble reserva entre pestañas.
if (seat && seat.status === 'available') {
  ...
}
```

### Qué explicar en el examen
> "Los comentarios deben explicar la intención técnica y la regla de negocio, no solo repetir la línea de código." 

---

# Resumen rápido para memorizar

## Si te piden algo de lógica de concurrencia
- sincronización
- evitar doble reserva
- validar compra

## Si te piden algo visual
- mostrar usuario
- precio por fila
- total
- factura previa

## Si te piden algo de control
- panel admin
- liberar reservas
- resetear asientos

## Si te piden algo de mantenimiento
- comentarios claros
- eventos bien nombrados
- snapshot inicial

---

# Frase corta de defensa oral

> "La app funciona porque el servidor mantiene el estado global y Socket.IO replica los cambios en tiempo real a los clientes. Si me piden una mejora, la implemento ajustando la lógica del servidor para que siga siendo la fuente de verdad y el cliente solo pinte la interfaz." 

