// Servidor con express + socket.io para reservas

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// servir archivos estáticos desde public
app.use(express.static(path.join(__dirname, 'public')));

// Estado global de los asientos
let seats = {};

// Crear asiento, A1-A10, B1-B10, C1-C10
['A', 'B', 'C'].forEach(row => {
    for (let i = 1; i <= 10; i++) {
        seats[`${row}${i}`] = { status: 'available', user: '', expiresAt: 0};
    }
});

// MANEJO DE CONEXIONES DE CLIENTES
io.on('connection', (socket) => {
    // Enviar estado actual al nuevo cliente
    socket.emit('init', seats);

    // Registrar el nombre del cliente
    socket.on('setUserName', (username) => {
        socket.username = username;
    })

    // manejar la reserva
    socket.on('reserved', (seatId) => {
        const seat = seats[seatId];
        // CORRECCIÓN 4: Acceder a la propiedad status
        if (seat && seat.status === 'available') {
            seat.status = 'reserved';
            seat.user = socket.username;
            seat.expiresAt = Date.now() + 60000;

            io.emit('reserved', { seatId, user: seat.user, expiresAt: seat.expiresAt});

            setTimeout(() => {
                if(seats[seatId].status === 'reserved'){
                    seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
                    io.emit('release', seatId);
                }
            }, 60000);
        }
    });

    // manejar la liberación del asiento de forma manual
    socket.on('release', (seatId) => {
       const seat = seats[seatId];
       if(seat.status === 'reserved' && seat.user === socket.username){
          seats[seatId] = { status: 'available', user: '', expiresAt: 0 };
          // comunicar a todos
          io.emit('release', seatId);
       }
    });

    // confirmar la compra de uno o más asientos
    socket.on('buy', (seatIds) => {
        seatIds.forEach((seatId) => {
            seats[seatId] = {status: 'sold', user: socket.username, expiresAt: 0};
            io.emit('buy', { seatId, user: socket.username });
        })

    });
});

// iniciar el servidor
const PORT = 2244;

server.listen(PORT, () => {
    console.log(`Server activo en ${PORT}`);
})


