/**
 * main.js - Radio Proximidad 100km
 * Manejo de Geolocalización, Validación de Rango (100 km) y WebSockets.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar conexión WebSocket
    const socket = io();

    // Variables de estado
    let miUbicacion = null;
    let miAlias = 'Anónimo_' + Math.floor(Math.random() * 1000);

    // Elementos del DOM
    const statusGeo = document.getElementById('geo-status');
    const aliasInput = document.getElementById('alias-input');
    const chatBox = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const listaEmisores = document.getElementById('emisores-list');
    const btnTransmitir = document.getElementById('btn-start-tx');

    // 2. Cálculo de distancia usando la Fórmula de Haversine (en kilómetros)
    function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);

        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distancia resultante en kilómetros
    }

    // 3. Obtener ubicación actual del dispositivo
    function obtenerUbicacion() {
        if (!navigator.geolocation) {
            if (statusGeo) statusGeo.textContent = "La geolocalización no está soportada por tu navegador.";
            return;
        }

        if (statusGeo) statusGeo.textContent = "Obteniendo coordenadas GPS...";

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                miUbicacion = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                if (statusGeo) {
                    statusGeo.textContent = `Ubicación activa (${miUbicacion.lat.toFixed(4)}, ${miUbicacion.lng.toFixed(4)})`;
                    statusGeo.style.color = '#50fa7b';
                }

                // Notificar al servidor que nos conectamos con esta ubicación
                socket.emit('registro_oyente', miUbicacion);
            },
            (error) => {
                if (statusGeo) {
                    statusGeo.textContent = "Error al obtener ubicación. Permiso denegado o GPS desactivado.";
                    statusGeo.style.color = '#ff5555';
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    // Inicializar obtención de ubicación
    obtenerUbicacion();

    // 4. Lógica de Transmisión (Página Transmitir)
    if (btnTransmitir) {
        let transmitiendo = false;

        btnTransmitir.addEventListener('click', () => {
            if (!miUbicacion) {
                alert("Necesitamos tu ubicación para validar el alcance de 100km antes de transmitir.");
                return;
            }

            transmitiendo = !transmitiendo;

            if (transmitiendo) {
                btnTransmitir.textContent = "DETENER TRANSMISIÓN";
                btnTransmitir.classList.remove('btn-emitir');
                btnTransmitir.style.backgroundColor = '#ff5555';
                
                socket.emit('iniciar_transmision', {
                    alias: aliasInput ? aliasInput.value || miAlias : miAlias,
                    lat: miUbicacion.lat,
                    lng: miUbicacion.lng
                });
            } else {
                btnTransmitir.textContent = "EMITIR SEÑAL";
                btnTransmitir.style.backgroundColor = '';
                btnTransmitir.classList.add('btn-emitir');

                socket.emit('detener_transmision');
            }
        });
    }

    // 5. Recepción de Emisores Cercanos (< 100 km)
    socket.on('actualizar_emisores', (emisores) => {
        if (!listaEmisores || !miUbicacion) return;

        listaEmisores.innerHTML = '';
        let emisoresEnRango = 0;

        emisores.forEach((emisor) => {
            const dist = calcularDistanciaKm(
                miUbicacion.lat, 
                miUbicacion.lng, 
                emisor.lat, 
                emisor.lng
            );

            // Filtro estricto: Solo mostrar si está dentro del radio de 100km
            if (dist <= 100) {
                emisoresEnRango++;
                const item = document.createElement('div');
                item.className = 'emisor-card';
                item.style.padding = '10px';
                item.style.margin = '5px 0';
                item.style.background = '#21262d';
                item.style.borderRadius = '6px';
                item.innerHTML = `
                    <strong>📻 Radio de: ${emisor.alias}</strong>
                    <span style="float: right; color: #50fa7b;">a ${dist.toFixed(1)} km</span>
                    <button onclick="sintonizar('${emisor.id}')" style="margin-top: 8px;" class="btn btn-escuchar">Escuchar</button>
                `;
                listaEmisores.appendChild(item);
            }
        });

        if (emisoresEnRango === 0) {
            listaEmisores.innerHTML = '<p>No hay transmisiones activas dentro del rango de 100 km.</p>';
        }
    });

    // 6. Lógica de Chat en Vivo
    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', enviarMensaje);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensaje();
        });
    }

    function enviarMensaje() {
        const msgText = chatInput.value.trim();
        if (!msgText || !miUbicacion) return;

        const aliasActual = (aliasInput && aliasInput.value.trim() !== '') 
            ? aliasInput.value.trim() 
            : miAlias;

        socket.emit('nuevo_mensaje', {
            alias: aliasActual,
            mensaje: msgText,
            lat: miUbicacion.lat,
            lng: miUbicacion.lng
        });

        chatInput.value = '';
    }

    // Recibir mensajes del chat de personas a menos de 100 km
    socket.on('mensaje_recibido', (data) => {
        if (!chatBox || !miUbicacion) return;

        // Validar que el mensaje recibido fue emitido a menos de 100 km
        const dist = calcularDistanciaKm(
            miUbicacion.lat, 
            miUbicacion.lng, 
            data.lat, 
            data.lng
        );

        if (dist <= 100) {
            const msgElement = document.createElement('div');
            msgElement.style.marginBottom = '8px';
            msgElement.innerHTML = `
                <span style="color: #8b949e; font-size: 0.8em;">[${data.hora}] (${dist.toFixed(1)} km)</span>
                <strong style="color: #50fa7b;"> ${data.alias}:</strong> 
                <span>${data.mensaje}</span>
            `;
            chatBox.appendChild(msgElement);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });
});