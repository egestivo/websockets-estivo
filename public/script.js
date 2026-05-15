// Conexion principal del cliente con el servidor Socket.IO.
const socket = io();

// Referencias del DOM principal de la vista del cliente.
const usernameInput = document.getElementById('userNameInput');
const seating = document.getElementById('seating');
const timerDisplay = document.getElementById('timerDisplay');
const buyBtn = document.getElementById('buyBtn');
const totalDisplay = document.getElementById('totalDisplay');
const invoiceList = document.getElementById('invoiceList');

// Estado local para pintar UI sin perder sincronizacion entre eventos.
const selectedSeats = new Set();
let seatsState = {};
let pricingByRow = { A: 6, B: 5, C: 4 };
let timerInterval = null;

// Crea el mapa visual base (A1..C10). Luego cada evento actualiza su estado.
function createSeats() {
    ['A', 'B', 'C'].forEach((row) => {
        for (let i = 1; i <= 10; i++) {
            const seatId = `${row}${i}`;
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.id = seatId;

            // Estructura interna para mostrar ID y, cuando aplica, usuario propietario.
            const seatIdLabel = document.createElement('div');
            seatIdLabel.className = 'seat-id';
            seatIdLabel.textContent = seatId;

            const seatOwnerLabel = document.createElement('div');
            seatOwnerLabel.className = 'seat-owner';
            seatOwnerLabel.textContent = '';

            seat.appendChild(seatIdLabel);
            seat.appendChild(seatOwnerLabel);

            seat.addEventListener('click', () => handleSeatClick(seatId));
            seating.appendChild(seat);
        }
    });
}

// Obtiene la fila desde el id del asiento (ej: A1 -> A).
function getRowFromSeatId(seatId) {
    return String(seatId).charAt(0);
}

// Formatea montos en dolares para la factura y el total.
function toMoney(value) {
    return `$${Number(value).toFixed(2)}`;
}

// Devuelve true si el asiento esta reservado por el usuario escrito en el input.
function isReservedByMe(seat) {
    const currentUser = usernameInput.value.trim();
    return Boolean(currentUser && seat.status === 'reserved' && seat.user === currentUser);
}

// Renderiza un asiento segun su estado global (available/reserved/sold).
function renderSeat(seatId) {
    const seatElement = document.getElementById(seatId);
    const seat = seatsState[seatId];

    if (!seatElement || !seat) {
        return;
    }

    seatElement.classList.remove('reserved', 'sold', 'mine');

    // Etiqueta visual secundaria para mostrar quien lo tiene reservado/comprado.
    const ownerLabel = seatElement.querySelector('.seat-owner');
    ownerLabel.textContent = '';

    if (seat.status === 'reserved') {
        seatElement.classList.add('reserved');
        if (isReservedByMe(seat)) {
            seatElement.classList.add('mine');
        }
        ownerLabel.textContent = seat.user ? `Res: ${seat.user}` : 'Reservado';
    }

    if (seat.status === 'sold') {
        seatElement.classList.add('sold');
        ownerLabel.textContent = seat.user ? `Vend: ${seat.user}` : 'Vendido';
    }

    // Tooltip obligatorio del enunciado: muestra estado + usuario al pasar mouse.
    if (seat.status === 'available') {
        seatElement.title = `Disponible - Precio ${toMoney(seat.price)}`;
    } else if (seat.status === 'reserved') {
        seatElement.title = `Reservado por ${seat.user || 'N/D'} - Precio ${toMoney(seat.price)}`;
    } else {
        seatElement.title = `Comprado por ${seat.user || 'N/D'} - Precio ${toMoney(seat.price)}`;
    }
}

// Re-renderiza todo cuando llega un snapshot completo del servidor.
function renderAllSeats() {
    Object.keys(seatsState).forEach(renderSeat);
}

// Limpia selecciones locales que ya no sean validas (ej. otro cliente compro/libero).
function normalizeSelectedSeats() {
    Array.from(selectedSeats).forEach((seatId) => {
        const seat = seatsState[seatId];
        if (!seat || !isReservedByMe(seat)) {
            selectedSeats.delete(seatId);
        }
    });
}

// Calcula y pinta total + mini factura antes de comprar.
function renderBilling() {
    normalizeSelectedSeats();

    let total = 0;
    invoiceList.innerHTML = '';

    if (selectedSeats.size === 0) {
        const emptyLine = document.createElement('li');
        emptyLine.textContent = 'No hay asientos seleccionados';
        invoiceList.appendChild(emptyLine);
        totalDisplay.textContent = `Total seleccionado: ${toMoney(0)}`;
        return;
    }

    Array.from(selectedSeats)
        .sort()
        .forEach((seatId) => {
            const seat = seatsState[seatId];
            const price = seat ? seat.price : pricingByRow[getRowFromSeatId(seatId)] || 0;
            total += price;

            const line = document.createElement('li');
            line.textContent = `${seatId} - ${toMoney(price)}`;
            invoiceList.appendChild(line);
        });

    totalDisplay.textContent = `Total seleccionado: ${toMoney(total)}`;
}

// Busca la expiracion mas cercana de reservas del usuario actual para mostrar timer.
function getNearestExpiryForCurrentUser() {
    const currentUser = usernameInput.value.trim();
    if (!currentUser) {
        return 0;
    }

    const expiries = Object.values(seatsState)
        .filter((seat) => seat.status === 'reserved' && seat.user === currentUser)
        .map((seat) => seat.expiresAt)
        .filter((expiresAt) => Number(expiresAt) > Date.now());

    if (expiries.length === 0) {
        return 0;
    }

    return Math.min(...expiries);
}

// Inicia o actualiza el temporizador de reserva del usuario actual.
function refreshTimer() {
    const nearestExpiry = getNearestExpiryForCurrentUser();

    if (!nearestExpiry) {
        stopTimer();
        timerDisplay.textContent = 'Sin reservas activas';
        return;
    }

    if (!timerInterval) {
        timerInterval = setInterval(() => {
            const currentNearestExpiry = getNearestExpiryForCurrentUser();

            if (!currentNearestExpiry) {
                stopTimer();
                timerDisplay.textContent = 'Sin reservas activas';
                return;
            }

            const diffSeconds = Math.max(0, Math.floor((currentNearestExpiry - Date.now()) / 1000));
            const minutes = String(Math.floor(diffSeconds / 60)).padStart(2, '0');
            const seconds = String(diffSeconds % 60).padStart(2, '0');
            timerDisplay.textContent = `Tiempo restante: ${minutes}:${seconds}`;

            if (diffSeconds <= 0) {
                stopTimer();
                timerDisplay.textContent = 'Sin reservas activas';
            }
        }, 1000);
    }
}

// Detiene el intervalo del timer para evitar intervalos duplicados.
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Aplica un estado nuevo de asiento que llega en tiempo real desde el servidor.
function applySeatUpdate(seatId, seat) {
    seatsState[seatId] = seat;
    renderSeat(seatId);
    renderBilling();
    refreshTimer();
}

// Manejador de click: decide reservar o liberar segun el estado real del asiento.
function handleSeatClick(seatId) {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Por favor ingresa tu nombre antes de seleccionar asientos.');
        return;
    }

    const seat = seatsState[seatId];
    if (!seat) {
        return;
    }

    // Siempre enviamos el nombre actual antes de operar para asociar acciones al usuario.
    socket.emit('setUserName', username);

    if (seat.status === 'sold') {
        return;
    }

    if (seat.status === 'reserved' && seat.user !== username) {
        alert(`El asiento ${seatId} ya esta reservado por ${seat.user}.`);
        return;
    }

    // Si el asiento ya era mio, al hacer click lo libero.
    if (seat.status === 'reserved' && seat.user === username) {
        selectedSeats.delete(seatId);
        socket.emit('release', seatId);
        return;
    }

    // Si esta disponible, lo marco localmente como seleccionado y pido reservar al servidor.
    selectedSeats.add(seatId);
    socket.emit('reserve', seatId);
}

// Confirmacion de compra para todos los asientos actualmente seleccionados.
buyBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Ingresa tu nombre antes de comprar.');
        return;
    }

    if (selectedSeats.size === 0) {
        alert('Selecciona al menos un asiento.');
        return;
    }

    socket.emit('setUserName', username);
    socket.emit('buy', Array.from(selectedSeats));
});

// Cada vez que cambia el usuario en el input, actualizamos timer/factura de su propia sesion.
usernameInput.addEventListener('input', () => {
    socket.emit('setUserName', usernameInput.value.trim());
    renderAllSeats();
    renderBilling();
    refreshTimer();
});

// Estado inicial al conectar (carga completa para clientes nuevos/reconectados).
socket.on('init', ({ seats, pricing }) => {
    seatsState = seats || {};
    pricingByRow = pricing || pricingByRow;

    renderAllSeats();
    renderBilling();
    refreshTimer();
});

// Snapshot global (usado por acciones de admin como reset y liberar reservas).
socket.on('snapshot', ({ seats, pricing }) => {
    seatsState = seats || {};
    pricingByRow = pricing || pricingByRow;

    renderAllSeats();
    renderBilling();
    refreshTimer();
});

// Actualizacion puntual de un solo asiento en tiempo real.
socket.on('seatUpdated', ({ seatId, seat }) => {
    applySeatUpdate(seatId, seat);
});

// Inicializa la vista al cargar.
createSeats();
renderBilling();
