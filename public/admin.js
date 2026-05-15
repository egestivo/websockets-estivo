// Conexion del panel admin con Socket.IO.
const socket = io();

// Elementos de la interfaz del admin.
const releaseAllBtn = document.getElementById('releaseAllBtn');
const resetSeatsBtn = document.getElementById('resetSeatsBtn');
const statAvailable = document.getElementById('statAvailable');
const statReserved = document.getElementById('statReserved');
const statSold = document.getElementById('statSold');
const adminTableBody = document.getElementById('adminTableBody');

// Estado global que el admin ve en pantalla.
let seatsState = {};

// Pinta la tabla y los contadores.
function paintAdmin() {
    const seatIds = Object.keys(seatsState).sort();
    let available = 0;
    let reserved = 0;
    let sold = 0;

    adminTableBody.innerHTML = '';

    seatIds.forEach((seatId) => {
        const seat = seatsState[seatId];

        if (seat.status === 'available') available += 1;
        if (seat.status === 'reserved') reserved += 1;
        if (seat.status === 'sold') sold += 1;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${seatId}</td>
            <td>${seat.status}</td>
            <td>${seat.user || '-'}</td>
            <td>$${Number(seat.price || 0).toFixed(2)}</td>
            <td>${seat.status === 'reserved' ? new Date(seat.expiresAt).toLocaleTimeString() : '-'}</td>
        `;
        adminTableBody.appendChild(row);
    });

    statAvailable.textContent = `Disponibles: ${available}`;
    statReserved.textContent = `Reservados: ${reserved}`;
    statSold.textContent = `Vendidos: ${sold}`;
}

// Acciones del admin: solo mandan orden al servidor.
releaseAllBtn.addEventListener('click', () => socket.emit('admin:releaseAllReservations'));
resetSeatsBtn.addEventListener('click', () => {
    if (window.confirm('Esto reseteara todo el estado de asientos. ¿Continuar?')) {
        socket.emit('admin:resetSeats');
    }
});

// Carga inicial y actualizaciones globales.
socket.on('init', ({ seats }) => {
    seatsState = seats || {};
    paintAdmin();
});

socket.on('snapshot', ({ seats }) => {
    seatsState = seats || {};
    paintAdmin();
});

socket.on('seatUpdated', ({ seatId, seat }) => {
    seatsState[seatId] = seat;
    paintAdmin();
});

