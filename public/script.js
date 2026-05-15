// Conexion principal con el servidor.
const socket = io();

// Elementos de la interfaz.
const usernameInput = document.getElementById('userNameInput');
const seating = document.getElementById('seating');
const timerDisplay = document.getElementById('timerDisplay');
const buyBtn = document.getElementById('buyBtn');
const totalDisplay = document.getElementById('totalDisplay');
const invoiceList = document.getElementById('invoiceList');

// Estado del cliente.
let seatsState = {};
let pricingByRow = { A: 6, B: 5, C: 4 };
let selectedSeats = [];
let timerInterval = null;

// Crear asientos una sola vez.
['A', 'B', 'C'].forEach((row) => {
    for (let i = 1; i <= 10; i++) {
        const seatId = `${row}${i}`;
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.id = seatId;
        seat.innerHTML = `<div class="seat-id">${seatId}</div><div class="seat-owner"></div>`;

        seat.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            const data = seatsState[seatId];

            if (!username) return alert('Ingresa tu nombre primero.');
            if (!data || data.status === 'sold') return;

            socket.emit('setUserName', username);

            if (data.status === 'reserved' && data.user === username) {
                selectedSeats = selectedSeats.filter((id) => id !== seatId);
                socket.emit('release', seatId);
                return;
            }

            if (data.status === 'available') {
                if (!selectedSeats.includes(seatId)) selectedSeats.push(seatId);
                socket.emit('reserve', seatId);
            }
        });

        seating.appendChild(seat);
    }
});

// Pinta un asiento segun su estado.
function paintSeat(seatId) {
    const seat = document.getElementById(seatId);
    const data = seatsState[seatId];
    if (!seat || !data) return;

    seat.classList.remove('reserved', 'sold', 'mine');
    seat.querySelector('.seat-owner').textContent = '';

    if (data.status === 'reserved') {
        seat.classList.add('reserved');
        seat.querySelector('.seat-owner').textContent = data.user ? `Res: ${data.user}` : 'Reservado';
        if (data.user === usernameInput.value.trim()) seat.classList.add('mine');
        seat.title = `Reservado por ${data.user} - Precio $${data.price.toFixed(2)}`;
    } else if (data.status === 'sold') {
        seat.classList.add('sold');
        seat.querySelector('.seat-owner').textContent = data.user ? `Vend: ${data.user}` : 'Vendido';
        seat.title = `Comprado por ${data.user} - Precio $${data.price.toFixed(2)}`;
    } else {
        seat.title = `Disponible - Precio $${data.price.toFixed(2)}`;
    }
}

// Pinta todo el mapa.
function paintAll() {
    Object.keys(seatsState).forEach(paintSeat);
}

// Pinta el total y la mini factura.
function paintInvoice() {
    invoiceList.innerHTML = '';

    if (!selectedSeats.length) {
        invoiceList.innerHTML = '<li>No hay asientos seleccionados</li>';
        totalDisplay.textContent = 'Total seleccionado: $0.00';
        return;
    }

    let total = 0;

    selectedSeats.forEach((seatId) => {
        const price = seatsState[seatId]?.price ?? pricingByRow[seatId[0]] ?? 0;
        total += price;

        const item = document.createElement('li');
        item.textContent = `${seatId} - $${price.toFixed(2)}`;
        invoiceList.appendChild(item);
    });

    totalDisplay.textContent = `Total seleccionado: $${total.toFixed(2)}`;
}

// Pinta timer de la reserva del usuario actual.
function paintTimer() {
    const username = usernameInput.value.trim();
    const expirations = Object.values(seatsState)
        .filter((seat) => seat.status === 'reserved' && seat.user === username)
        .map((seat) => seat.expiresAt)
        .filter((expiresAt) => expiresAt > Date.now());

    if (!expirations.length) {
        timerDisplay.textContent = 'Sin reservas activas';
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        return;
    }

    const expiresAt = Math.min(...expirations);
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            timerDisplay.textContent = `Tiempo restante: ${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
            if (diff === 0) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }, 1000);
    }
}

// Refresca toda la pantalla.
function refresh() {
    paintAll();
    paintInvoice();
    paintTimer();
}

// Estado inicial y cambios en tiempo real.
socket.on('init', ({ seats, pricing }) => {
    seatsState = seats || {};
    pricingByRow = pricing || pricingByRow;
    refresh();
});

socket.on('snapshot', ({ seats, pricing }) => {
    seatsState = seats || {};
    pricingByRow = pricing || pricingByRow;
    selectedSeats = selectedSeats.filter((seatId) => seatsState[seatId] && seatsState[seatId].status === 'reserved');
    refresh();
});

socket.on('seatUpdated', ({ seatId, seat }) => {
    seatsState[seatId] = seat;
    selectedSeats = selectedSeats.filter((id) => id !== seatId || (seat.status === 'reserved' && seat.user === usernameInput.value.trim()));
    refresh();
});

// Comprar los asientos seleccionados.
buyBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) return alert('Ingresa tu nombre antes de comprar.');
    if (!selectedSeats.length) return alert('Selecciona al menos un asiento.');

    socket.emit('setUserName', username);
    socket.emit('buy', selectedSeats);
});

// Si cambia el nombre, solo repintamos etiquetas y timer.
usernameInput.addEventListener('input', () => {
    socket.emit('setUserName', usernameInput.value.trim());
    refresh();
});

