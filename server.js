// Servidor HTTP + WebSocket para controlar asientos en tiempo real.
// Mantiene el estado en memoria mientras el proceso siga encendido.

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Duracion de la reserva temporal: 60 segundos.
const RESERVATION_MS = 60_000;

// Filas y columnas del cine (A1..A10, B1..B10, C1..C10).
const ROWS = ['A', 'B', 'C'];
const SEATS_PER_ROW = 10;

// Tarifas por fila para calcular totales en el cliente.
const PRICING_BY_ROW = {
    A: 6,
    B: 5,
    C: 4
};

// servir archivos estáticos desde public
app.use(express.static(path.join(__dirname, 'public')));

// Construye el estado inicial completo de los asientos.
function createInitialSeatsState() {
    const initialSeats = {};

    ROWS.forEach((row) => {
        for (let i = 1; i <= SEATS_PER_ROW; i++) {
            const seatId = `${row}${i}`;
            initialSeats[seatId] = {
                status: 'available',
                user: '',
                expiresAt: 0,
                price: PRICING_BY_ROW[row]
            };
        }
    });

    return initialSeats;
}

// Estado global en memoria (fuente de verdad para todos los clientes conectados).
let seats = createInitialSeatsState();

// Envia a todos los clientes una foto completa del estado.
function broadcastSnapshot() {
    io.emit('snapshot', { seats, pricing: PRICING_BY_ROW });
}

// MANEJO DE CONEXIONES DE CLIENTES
io.on('connection', (socket) => {
    // Enviar estado actual al nuevo cliente (incluye precios por fila).
    socket.emit('init', { seats, pricing: PRICING_BY_ROW });

    // Registrar/actualizar el nombre del cliente.
    socket.on('setUserName', (username) => {
        socket.username = String(username || '').trim();
    });

    // Intento de reserva: solo se permite si el asiento esta disponible.
    socket.on('reserve', (seatId) => {
        const seat = seats[seatId];
        const username = String(socket.username || '').trim();

        if (!seat || !username || seat.status !== 'available') {
            return;
        }

        seat.status = 'reserved';
        seat.user = username;
        seat.expiresAt = Date.now() + RESERVATION_MS;

        // Notificar cambio puntual para evitar repintar todo en cada accion.
        io.emit('seatUpdated', { seatId, seat });

        // Capturamos la expiracion para no liberar una reserva nueva por un timeout viejo.
        const expectedExpiry = seat.expiresAt;
        setTimeout(() => {
            const currentSeat = seats[seatId];
            if (
                currentSeat &&
                currentSeat.status === 'reserved' &&
                currentSeat.expiresAt === expectedExpiry
            ) {
                seats[seatId] = {
                    ...currentSeat,
                    status: 'available',
                    user: '',
                    expiresAt: 0
                };
                io.emit('seatUpdated', { seatId, seat: seats[seatId] });
            }
        }, RESERVATION_MS);
    });

    // Liberacion manual: solo puede liberar el usuario que lo reservo.
    socket.on('release', (seatId) => {
       const seat = seats[seatId];
       const username = String(socket.username || '').trim();

       if (!seat || seat.status !== 'reserved' || seat.user !== username) {
           return;
       }

       seats[seatId] = {
           ...seat,
           status: 'available',
           user: '',
           expiresAt: 0
       };

       io.emit('seatUpdated', { seatId, seat: seats[seatId] });
    });

    // Confirmar compra de varios asientos (solo los que ese usuario tiene reservados).
    socket.on('buy', (seatIds) => {
        const username = String(socket.username || '').trim();
        if (!Array.isArray(seatIds) || !username) {
            return;
        }

        seatIds.forEach((seatId) => {
            const seat = seats[seatId];

            if (!seat || seat.status !== 'reserved' || seat.user !== username) {
                return;
            }

            seats[seatId] = {
                ...seat,
                status: 'sold',
                user: username,
                expiresAt: 0
            };

            io.emit('seatUpdated', { seatId, seat: seats[seatId] });
        });
    });

    // Panel admin: libera todas las reservas activas sin tocar los asientos vendidos.
    socket.on('admin:releaseAllReservations', () => {
        Object.keys(seats).forEach((seatId) => {
            const seat = seats[seatId];
            if (seat.status === 'reserved') {
                seats[seatId] = {
                    ...seat,
                    status: 'available',
                    user: '',
                    expiresAt: 0
                };
            }
        });

        broadcastSnapshot();
    });

    // Panel admin: reinicia por completo el mapa de asientos al estado inicial.
    socket.on('admin:resetSeats', () => {
        seats = createInitialSeatsState();
        broadcastSnapshot();
    });
});

// iniciar el servidor
const PORT = 2244;

server.listen(PORT, () => {
    console.log(`Server activo en ${PORT}`);
})


