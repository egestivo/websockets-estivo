// Conexion del panel admin con Socket.IO para ver cambios en tiempo real.
const socket = io();

// Referencias de la interfaz del panel de administrador.
const releaseAllBtn = document.getElementById('releaseAllBtn');
const resetSeatsBtn = document.getElementById('resetSeatsBtn');
const statAvailable = document.getElementById('statAvailable');
const statReserved = document.getElementById('statReserved');
const statSold = document.getElementById('statSold');
const adminTableBody = document.getElementById('adminTableBody');

// Estado local para renderizar tabla y contadores.
let seatsState = {};

// Convierte timestamps a una hora legible; devuelve guion si no aplica.
function toTime(expiresAt) {
    if (!expiresAt) {
        return '-';
    }

    return new Date(expiresAt).toLocaleTimeString();
}

// Formatea precio para mantener consistencia visual con la vista de cliente.
function toMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

// Renderiza contadores + tabla completa de asientos.
function renderAdminView() {
    const seats = Object.entries(seatsState).sort(([a], [b]) => a.localeCompare(b));

    let availableCount = 0;
    let reservedCount = 0;
    let soldCount = 0;

    adminTableBody.innerHTML = '';

    seats.forEach(([seatId, seat]) => {
        if (seat.status === 'available') availableCount += 1;
        if (seat.status === 'reserved') reservedCount += 1;
        if (seat.status === 'sold') soldCount += 1;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${seatId}</td>
            <td>${seat.status}</td>
            <td>${seat.user || '-'}</td>
            <td>${toMoney(seat.price)}</td>
            <td>${seat.status === 'reserved' ? toTime(seat.expiresAt) : '-'}</td>
        `;

        adminTableBody.appendChild(row);
    });

    statAvailable.textContent = `Disponibles: ${availableCount}`;
    statReserved.textContent = `Reservados: ${reservedCount}`;
    statSold.textContent = `Vendidos: ${soldCount}`;
}

// Boton para liberar todas las reservas (sin tocar asientos vendidos).
releaseAllBtn.addEventListener('click', () => {
    socket.emit('admin:releaseAllReservations');
});

// Boton para reiniciar completamente el mapa de asientos.
resetSeatsBtn.addEventListener('click', () => {
    const confirmed = window.confirm('Esto reseteara todo el estado de asientos. ¿Continuar?');
    if (confirmed) {
        socket.emit('admin:resetSeats');
    }
});

// Carga inicial al entrar al panel.
socket.on('init', ({ seats }) => {
    seatsState = seats || {};
    renderAdminView();
});

// Snapshot completo cuando el admin ejecuta acciones globales.
socket.on('snapshot', ({ seats }) => {
    seatsState = seats || {};
    renderAdminView();
});

// Actualizacion de un solo asiento para reaccion inmediata.
socket.on('seatUpdated', ({ seatId, seat }) => {
    seatsState[seatId] = seat;
    renderAdminView();
});

