document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const btnClosed = document.getElementById('btnClosed');
    const btnManaged = document.getElementById('btnManaged');
    const btnTimer = document.getElementById('btnTimer');
    const btnReset = document.getElementById('btnReset');
    const casesClosed = document.getElementById('casesClosed');
    const casesManaged = document.getElementById('casesManaged');
    const closeRate = document.getElementById('closeRate');
    const casesPerHour = document.getElementById('casesPerHour');
    const avgClosed = document.getElementById('avgClosed');
    const avgManaged = document.getElementById('avgManaged');
    const timer = document.getElementById('timer');
    const mensajeError = document.getElementById('mensajeError');
    const mensajeInfo = document.getElementById('mensajeInfo');
    const standardCasesPerHour = document.getElementById('standardCasesPerHour');
    const standardAvgClosed = document.getElementById('standardAvgClosed');
    const standardAvgManaged = document.getElementById('standardAvgManaged');
    
    // Estándares definidos
    const STANDARD_CLOSED_PER_HOUR = 2.8;
    const STANDARD_MANAGED_PER_HOUR = 3.8;
    
    // Variables para contadores
    let closedCount = 0;
    let managedCount = 0;
    let timerRunning = false;
    let timerInterval;
    let startTime; // Tiempo de inicio en milisegundos
    let pausedTime = 0; // Tiempo acumulado en pausas anteriores
    let seconds = 0;
    let minutes = 0;
    let hours = 0;
    
    // Variables para control de notificaciones
    let lastNotificationTime = 0;
    const NOTIFICATION_COOLDOWN = 300000; // 5 minutos en milisegundos
    let notificationsEnabled = false;
    let belowStandardMetrics = {
        closed: false,
        managed: false,
        total: false
    };
    
    // Verificar soporte para notificaciones
    function checkNotificationSupport() {
        if (!("Notification" in window)) {
            console.log("Este navegador no soporta notificaciones de escritorio");
            return false;
        }
        return true;
    }
    
    // Solicitar permiso para notificaciones
    function requestNotificationPermission() {
        if (!checkNotificationSupport()) return;
        
        Notification.requestPermission().then(function(permission) {
            if (permission === "granted") {
                notificationsEnabled = true;
                console.log("Notificaciones habilitadas");
            }
        });
    }
    
    // Solicitar permiso al iniciar
    requestNotificationPermission();
    
    // Función para enviar notificación
    function sendNotification(title, message) {
        if (!notificationsEnabled) return;
        
        // Verificar si ha pasado suficiente tiempo desde la última notificación
        const now = Date.now();
        if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) return;
        
        lastNotificationTime = now;
        
        const notification = new Notification(title, {
            body: message,
            icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="currentColor"/></svg>'
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
    
    // Función para verificar métricas y enviar notificaciones
    function checkMetricsAndNotify(closedPerHour, managedPerHour) {
        // Solo verificar si el timer está corriendo y han pasado al menos 5 minutos
        if (!timerRunning || (hours === 0 && minutes < 5)) return;
        
        let belowStandardMessages = [];
        let anyBelowStandard = false;
        
        // Verificar casos cerrados por hora
        if (closedPerHour < STANDARD_CLOSED_PER_HOUR) {
            if (!belowStandardMetrics.closed) {
                belowStandardMessages.push(`Casos cerrados por hora (${closedPerHour}) por debajo del estándar (${STANDARD_CLOSED_PER_HOUR})`);
                belowStandardMetrics.closed = true;
                anyBelowStandard = true;
            }
        } else {
            belowStandardMetrics.closed = false;
        }
        
        // Verificar casos gestionados por hora
        if (managedPerHour < STANDARD_MANAGED_PER_HOUR) {
            if (!belowStandardMetrics.managed) {
                belowStandardMessages.push(`Casos gestionados por hora (${managedPerHour}) por debajo del estándar (${STANDARD_MANAGED_PER_HOUR})`);
                belowStandardMetrics.managed = true;
                anyBelowStandard = true;
            }
        } else {
            belowStandardMetrics.managed = false;
        }
        
        // Enviar notificación si hay métricas por debajo del estándar
        if (anyBelowStandard) {
            const title = "¡Alerta de Rendimiento!";
            const message = belowStandardMessages.join("\n");
            sendNotification(title, message);
        }
    }
    
    // Agregar controlador para prevenir refrescar la página accidentalmente
    window.addEventListener('beforeunload', function(e) {
        // Solo mostrar confirmación si hay datos registrados o el timer está corriendo
        if (closedCount > 0 || managedCount > 0 || timerRunning) {
            // Mensaje que se mostrará (los navegadores modernos usan su propio mensaje genérico)
            const mensaje = "¿Estás seguro de que quieres salir? Perderás todos los datos registrados.";
            e.returnValue = mensaje; // Estándar
            return mensaje; // Para navegadores antiguos
        }
    });
    
    // Función para mostrar mensaje de error
    function mostrarError(mensaje) {
        mensajeError.textContent = mensaje;
        mensajeError.classList.add('activo');
        
        // Ocultar el mensaje después de 3 segundos
        setTimeout(() => {
            mensajeError.classList.remove('activo');
        }, 3000);
    }
    
    // Función para actualizar el estado de los botones
    function actualizarEstadoBotones() {
        // Verificar si el temporizador está en marcha
        if (!timerRunning) {
            btnClosed.classList.add('disabled');
            btnClosed.disabled = true;
            btnManaged.classList.add('disabled');
            btnManaged.disabled = true;
            return;
        }
        
        // Habilitar botón de casos gestionados
        btnManaged.classList.remove('disabled');
        btnManaged.disabled = false;
        
        // Verificar si se pueden cerrar más casos
        if (closedCount >= managedCount) {
            btnClosed.classList.add('disabled');
            btnClosed.disabled = true;
        } else {
            btnClosed.classList.remove('disabled');
            btnClosed.disabled = false;
        }
    }
    
    // Función para actualizar los indicadores de estándares
    function actualizarIndicadoresEstandares(closedPerHour, managedPerHour) {
        // Verificar estándar para casos cerrados
        if (closedPerHour >= STANDARD_CLOSED_PER_HOUR) {
            avgClosed.classList.remove('stat-below-standard');
            avgClosed.classList.add('stat-meets-standard');
            standardAvgClosed.classList.remove('standard-below');
            standardAvgClosed.classList.add('standard-meets');
            standardAvgClosed.textContent = "Cumple el estándar";
        } else {
            avgClosed.classList.remove('stat-meets-standard');
            avgClosed.classList.add('stat-below-standard');
            standardAvgClosed.classList.remove('standard-meets');
            standardAvgClosed.classList.add('standard-below');
            standardAvgClosed.textContent = "Por debajo del estándar";
        }
        
        // Verificar estándar para casos gestionados
        if (managedPerHour >= STANDARD_MANAGED_PER_HOUR) {
            avgManaged.classList.remove('stat-below-standard');
            avgManaged.classList.add('stat-meets-standard');
            standardAvgManaged.classList.remove('standard-below');
            standardAvgManaged.classList.add('standard-meets');
            standardAvgManaged.textContent = "Cumple el estándar";
        } else {
            avgManaged.classList.remove('stat-meets-standard');
            avgManaged.classList.add('stat-below-standard');
            standardAvgManaged.classList.remove('standard-meets');
            standardAvgManaged.classList.add('standard-below');
            standardAvgManaged.textContent = "Por debajo del estándar";
        }
        
        // Verificar estándar para casos totales por hora
        if (managedPerHour >= STANDARD_MANAGED_PER_HOUR) {
            casesPerHour.classList.remove('stat-below-standard');
            casesPerHour.classList.add('stat-meets-standard');
            standardCasesPerHour.classList.remove('standard-below');
            standardCasesPerHour.classList.add('standard-meets');
            standardCasesPerHour.textContent = "Cumple el estándar";
        } else {
            casesPerHour.classList.remove('stat-meets-standard');
            casesPerHour.classList.add('stat-below-standard');
            standardCasesPerHour.classList.remove('standard-meets');
            standardCasesPerHour.classList.add('standard-below');
            standardCasesPerHour.textContent = "Por debajo del estándar";
        }
        
        // Verificar métricas y enviar notificaciones si es necesario
        checkMetricsAndNotify(closedPerHour, managedPerHour);
    }
    
    // Función para actualizar estadísticas
    function updateStats() {
        // Porcentaje de cierre
        const percentage = managedCount > 0 ? ((closedCount / managedCount) * 100).toFixed(1) : 0;
        closeRate.textContent = percentage + '%';
        
        // Calcular métricas basadas en tiempo
        const totalSeconds = seconds + (minutes * 60) + (hours * 3600);
        const totalHours = totalSeconds / 3600;
        
        let closedPerHour = 0;
        let managedPerHour = 0;
        let totalPerHour = 0;
        
        if (totalSeconds > 0) {
            // Casos por hora (total)
            totalPerHour = totalHours > 0 ? ((managedCount) / totalHours).toFixed(1) : 0;
            casesPerHour.textContent = totalPerHour;
            
            // Promedio de casos cerrados por hora
            closedPerHour = totalHours > 0 ? (closedCount / totalHours).toFixed(1) : 0;
            avgClosed.textContent = closedPerHour;
            
            // Promedio de casos gestionados por hora
            managedPerHour = totalHours > 0 ? (managedCount / totalHours).toFixed(1) : 0;
            avgManaged.textContent = managedPerHour;
            
            // Actualizar indicadores de estándares
            actualizarIndicadoresEstandares(closedPerHour, managedPerHour);
        }
        
        // Actualizar estado de botones
        actualizarEstadoBotones();
    }
    
    // Función para actualizar el temporizador
    function updateTimer() {
        // Calcular el tiempo transcurrido basado en la hora actual
        const currentTime = Date.now();
        const elapsedMilliseconds = currentTime - startTime + pausedTime;
        
        // Convertir a segundos, minutos y horas
        const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
        seconds = totalSeconds % 60;
        minutes = Math.floor(totalSeconds / 60) % 60;
        hours = Math.floor(totalSeconds / 3600);
        
        // Formatear el tiempo como HH:MM:SS
        const formattedTime = [
            hours.toString().padStart(2, "0"),
            minutes.toString().padStart(2, "0"),
            seconds.toString().padStart(2, "0")
        ].join(":");
        
        timer.textContent = formattedTime;
        updateStats();
    }
    
    // Evento para iniciar/detener el temporizador
    btnTimer.addEventListener('click', function() {
        if (timerRunning) {
            // Detener el temporizador
            clearInterval(timerInterval);
            // Guardar el tiempo transcurrido hasta ahora
            pausedTime += Date.now() - startTime;
            btnTimer.textContent = "Iniciar Tiempo";
            mensajeInfo.textContent = "Tiempo detenido. Inicia el tiempo para continuar registrando casos";
            mensajeInfo.style.display = "block";
        } else {
            // Iniciar el temporizador con la hora actual
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
            btnTimer.textContent = "Detener Tiempo";
            mensajeInfo.style.display = "none";
            
            // Solicitar permiso para notificaciones si no se ha hecho
            if (!notificationsEnabled) {
                requestNotificationPermission();
            }
        }
        
        timerRunning = !timerRunning;
        actualizarEstadoBotones();
    });
    
    // Evento para añadir caso cerrado
    btnClosed.addEventListener('click', function() {
        if (closedCount < managedCount) {
            closedCount++;
            casesClosed.textContent = closedCount;
            updateStats();
        } else {
            mostrarError("No puedes cerrar más casos de los que has gestionado");
        }
    });
    
    // Evento para añadir caso gestionado
    btnManaged.addEventListener('click', function() {
        managedCount++;
        casesManaged.textContent = managedCount;
        updateStats();
        actualizarEstadoBotones();
    });
    
    // Evento para reiniciar
    btnReset.addEventListener('click', function() {
        // Reiniciar contadores
        closedCount = 0;
        managedCount = 0;
        
        // Reiniciar temporizador
        clearInterval(timerInterval);
        timerRunning = false;
        startTime = 0;
        pausedTime = 0;
        seconds = 0;
        minutes = 0;
        hours = 0;
        
        // Reiniciar estado de notificaciones
        belowStandardMetrics = {
            closed: false,
            managed: false,
            total: false
        };
        
        // Actualizar la interfaz
        casesClosed.textContent = '0';
        casesManaged.textContent = '0';
        closeRate.textContent = '0%';
        casesPerHour.textContent = '0';
        avgClosed.textContent = '0';
        avgManaged.textContent = '0';
        timer.textContent = '00:00:00';
        btnTimer.textContent = "Iniciar Tiempo";
        
        // Restablecer mensaje de información
        mensajeInfo.textContent = "Inicia el tiempo para comenzar a registrar casos";
        mensajeInfo.style.display = "block";
        
        // Restablecer indicadores de estándares
        avgClosed.classList.remove('stat-meets-standard');
        avgClosed.classList.add('stat-below-standard');
        standardAvgClosed.classList.remove('standard-meets');
        standardAvgClosed.classList.add('standard-below');
        standardAvgClosed.textContent = "Por debajo del estándar";
        
        avgManaged.classList.remove('stat-meets-standard');
        avgManaged.classList.add('stat-below-standard');
        standardAvgManaged.classList.remove('standard-meets');
        standardAvgManaged.classList.add('standard-below');
        standardAvgManaged.textContent = "Por debajo del estándar";
        
        casesPerHour.classList.remove('stat-meets-standard');
        casesPerHour.classList.add('stat-below-standard');
        standardCasesPerHour.classList.remove('standard-meets');
        standardCasesPerHour.classList.add('standard-below');
        standardCasesPerHour.textContent = "Por debajo del estándar";
        
        // Resetear estado de botones
        actualizarEstadoBotones();
    });
    
    // Inicializar estado de botones
    actualizarEstadoBotones();
});