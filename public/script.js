const socket = io();

// Elementos del DOM que usamos en la interfaz:
// Input donde el usuario ingresa su nombre (por ejemplo para identificar la reserva)
const usernameInput = document.getElementById('userNameInput');
// Contenedor donde se muestran los asientos (mapa de butacas)
const seating = document.getElementById('seating');
// Elemento donde se muestra el temporizador de reserva (tiempo restante para completar la compra)
const timerDisplay = document.getElementById('timerDisplay');
// Botón para confirmar/comprar los asientos seleccionados
const buyBtn = document.getElementById('buyBtn');

// Conjunto que almacena los asientos seleccionados por el usuario en esta sesión
// Usamos un Set para evitar duplicados y facilitar añadir / quitar asientos
const selectSeats = new Set();

// Referencia al intervalo (setInterval) que actualiza el temporizador en pantalla.
// Es null cuando no hay temporizador activo.
let timerInterval = null;
// Marca de tiempo (en milisegundos, epoch) que indica cuándo expira la reserva temporal.
// Si vale 0 significa que no hay reserva en curso.
let reservationEndTime = 0;

// Crear los asientos de manera dinámica
function createSeats () {
    ['A', 'B', 'C'].forEach(row =>{
        for (let i = 0; i < 10; i++) {
            const seatId = row + (i+1);
            const div = document.createElement('div');
            div.className = 'seat';
            div.id = seatId;
            div.innerText = seatId;

            //Evento al hacer click sobre un asiento
            div.addEventListener('click', () => {
                // username, y validar que haya algo obvio
                const username = usernameInput.value.trim();
                if (!username) {
                    alert("Por favor ingresa tu nombre");
                    return;
                }

                // emite el mensaje
                socket.emit('setUserName', username);

                // si ya está vendido, entonces solo sale de la función
                if(div.classList.contains('sold')) return;

                // deselecionar si ya estaba seleccionado
                if(selectSeats.has(seatId)){
                    selectSeats.delete(seatId);
                    div.classList.remove('reserved');
                    socket.emit('release', seatId);
                    stopTimer();
                } else {
                    // cuando se selecciona una asiento y se reserva
                    selectSeats.add(seatId);
                    div.classList.add('reserved');
                    socket.emit('reserved', seatId);
                }
            });

            seating.appendChild(div);
        }
    })
}

createSeats();

// Recibir el estado inicial de los asientos desde el servidor
socket.on('init', (serverSeats) =>{
    Object.entries(serverSeats).forEach(([id, info]) => {
        const seat = document.getElementById(id);
        if(info.status === 'reserved') seat.classList.add('reserved');
        if(info.status === 'sold') seat.classList.add('sold')
    })
})

// cuando el asiento es reservado
socket.on('reserved', ({ seatId, user, expiresAt }) => {
    const seat = document.getElementById(seatId);
    // Verifica si el asiento es mío para activar mi timer
    if (user === usernameInput.value.trim()){
        reservationEndTime = expiresAt;
        startTimer();
    }
});

// cuando el asiento es liberado
socket.on('release', (seatId) => {
    const seat = document.getElementById(seatId);
    if (seat) seat.classList.remove('reserved');

    // Solo quitamos de nuestro set si nosotros lo teníamos
    selectSeats.delete(seatId);
    
    if (selectSeats.size === 0) {
        stopTimer();
    }
});

// cuando compra el asiento
socket.on('buy', (data) => {
    const seat = document.getElementById(data.seatId);
    if (seat) {
        seat.classList.remove('reserved');
        seat.classList.add('sold');
    }
});

// confirmación de compra
buyBtn.addEventListener('click', () => {
    if(selectSeats.size > 0){ // .size es lo correcto para Sets
        socket.emit('buy', Array.from(selectSeats));
        selectSeats.clear();
        stopTimer();
    }
});

// mostrar temporizador regresivo
function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
        const diff = Math.max(0, Math.floor(reservationEndTime - Date.now())/1000);
        timerDisplay.innerText = `Tiempo restante: ${diff} s`
        if(diff <= 0) stopTimer();
    }, 1000)
}

function stopTimer(){
    if(timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.innerText = '00:00:00';
    }
}