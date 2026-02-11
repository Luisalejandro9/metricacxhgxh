document.addEventListener('DOMContentLoaded', function () {
    // Elementos del dom 
    const btnClosed = document.getElementById('btnClosed');
    const btnSubtractClosed = document.getElementById('btnSubtractClosed');
    const btnManaged = document.getElementById('btnManaged');
    const btnSubtractManaged = document.getElementById('btnSubtractManaged');
    const btnTechnicians = document.getElementById('btnTechnicians');
    const btnSubtractTechnicians = document.getElementById('btnSubtractTechnicians');
    const btnTimer = document.getElementById('btnTimer');
    const btnReset = document.getElementById('btnReset');
    const casesClosed = document.getElementById('casesClosed');
    const casesManaged = document.getElementById('casesManaged');
    const closeRate = document.getElementById('closeRate');
    const casesPerHour = document.getElementById('casesPerHour');
    const avgClosed = document.getElementById('avgClosed');
    const tiempoPorCaso = document.getElementById('tiempoPorCaso');
    const standardTiempoPorCaso = document.getElementById('standardTiempoPorCaso');
    const tiempoPorGestionado = document.getElementById('tiempoPorGestionado');
    const standardTiempoPorGestionado = document.getElementById('standardTiempoPorGestionado');
    const techniciansCountDisplay = document.getElementById('techniciansCount');
    const resolutionRateDisplay = document.getElementById('resolutionRate');
    const timer = document.getElementById('timer');
    const mensajeError = document.getElementById('mensajeError');
    const mensajeInfo = document.getElementById('mensajeInfo');
    const standardCasesPerHour = document.getElementById('standardCasesPerHour');
    const standardAvgClosed = document.getElementById('standardAvgClosed');
    const standardResolutionRate = document.getElementById('standardResolutionRate');

    // Variables globales
    let closedCount = 0;
    let managedCount = 0;
    let techniciansCount = 0;
    let timerRunning = false;
    let timerInterval = null;
    let startTime = 0;
    let pausedTime = 0;
    let seconds = 0;
    let minutes = 0;
    let hours = 0;
    let notificationsEnabled = false;
    let belowStandardMetrics = {
        closed: false,
        managed: false,
        total: false,
        tiempoPorCaso: false,
        tiempoPorGestionado: false,
        resolution: false
    };

    // Variables Gráfica
    let casesChart = null;
    let managedTimestamps = [];

    // Estándares definidos
    const STANDARD_MANAGED_PER_HOUR = 3.78;
    const STANDARD_CLOSED_PER_HOUR = 3.78;
    const STANDARD_TIME_PER_CASE = 950; // Estándar: tiempo promedio por caso en segundos
    const STANDARD_TIME_PER_MANAGED = 950; // Estándar: tiempo promedio por caso gestionado en segundos
    const STANDARD_RESOLUTION_PERCENTAGE = 76.80;

    // Función para mostrar mensajes de error
    function mostrarError(mensaje) {
        mensajeError.textContent = mensaje;
        mensajeError.classList.add('activo');

        setTimeout(function () {
            mensajeError.classList.remove('activo');
        }, 3000);
    }

    // Función para solicitar permiso para notificaciones
    function requestNotificationPermission() {
        if (!("Notification" in window)) {
            console.log("Este navegador no soporta notificaciones");
            return;
        }

        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                notificationsEnabled = true;
                console.log("Permiso de notificaciones concedido");
            }
        });
    }

    // Función para enviar notificaciones
    function sendNotification(title, message) {
        if (!notificationsEnabled) return;

        const options = {
            body: message,
            icon: 'img/icon.png'
        };

        new Notification(title, options);
    }

    // Función para calcular el tiempo promedio por caso cerrado en segundos
    function calcularTiempoPromedioPorCaso() {
        if (closedCount === 0) {
            return 0;
        }

        // Calcular el tiempo total en segundos
        const totalSeconds = seconds + (minutes * 60) + (hours * 3600);

        // Calcular el promedio (tiempo total / casos cerrados)
        return Math.floor(totalSeconds / closedCount);
    }

    // Función para calcular el tiempo promedio por caso gestionado en segundos
    function calcularTiempoPromedioPorGestionado() {
        if (managedCount === 0) {
            return 0;
        }

        // Calcular el tiempo total en segundos
        const totalSeconds = seconds + (minutes * 60) + (hours * 3600);

        // Calcular el promedio (tiempo total / casos gestionados)
        return Math.floor(totalSeconds / managedCount);
    }

    // Función para actualizar el estado de los botones
    function actualizarEstadoBotones() {
        // Verificar si el temporizador está en marcha
        if (!timerRunning) {
            btnClosed.classList.add('disabled');
            btnClosed.disabled = true;
            btnSubtractClosed.classList.add('disabled');
            btnSubtractClosed.disabled = true;

            btnManaged.classList.add('disabled');
            btnManaged.disabled = true;
            btnSubtractManaged.classList.add('disabled');
            btnSubtractManaged.disabled = true;

            btnTechnicians.classList.add('disabled');
            btnTechnicians.disabled = true;
            btnSubtractTechnicians.classList.add('disabled');
            btnSubtractTechnicians.disabled = true;
            return;
        }

        // Habilitar botón de casos gestionados (Add)
        btnManaged.classList.remove('disabled');
        btnManaged.disabled = false;

        // Habilitar botón de restar gestionados solo si > 0
        if (managedCount > 0) {
            // Can only subtract managed if it won't result in managed < closed
            // e.g. Managed=5, Closed=5. If I subtract Managed -> 4. 4 < 5 Error.
            if ((managedCount - 1) >= closedCount) {
                btnSubtractManaged.classList.remove('disabled');
                btnSubtractManaged.disabled = false;
            } else {
                btnSubtractManaged.classList.add('disabled');
                btnSubtractManaged.disabled = true;
            }
        } else {
            btnSubtractManaged.classList.add('disabled');
            btnSubtractManaged.disabled = true;
        }

        // Habilitar botón de restar cerrados solo si > 0
        if (closedCount > 0) {
            btnSubtractClosed.classList.remove('disabled');
            btnSubtractClosed.disabled = false;
        } else {
            btnSubtractClosed.classList.add('disabled');
            btnSubtractClosed.disabled = true;
        }

        // Verificar si se pueden cerrar más casos (Add Closed)
        if (closedCount >= managedCount) {
            btnClosed.classList.add('disabled');
            btnClosed.disabled = true;
        } else {
            btnClosed.classList.remove('disabled');
            btnClosed.disabled = false;
        }

        // Habilitar botón de técnicos si el timer corre
        btnTechnicians.classList.remove('disabled');
        btnTechnicians.disabled = false;

        // Habilitar botón de restar técnicos solo si > 0
        if (techniciansCount > 0) {
            btnSubtractTechnicians.classList.remove('disabled');
            btnSubtractTechnicians.disabled = false;
        } else {
            btnSubtractTechnicians.classList.add('disabled');
            btnSubtractTechnicians.disabled = true;
        }
    }

    // Función para verificar métricas y enviar notificaciones
    function checkMetricsAndNotify(closedPerHour, managedPerHour, tiempoPromedio, tiempoPromedioGestionado, resolutionPercentage) {
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

        // Verificar tiempo promedio por caso
        if (tiempoPromedio > 0 && tiempoPromedio >= STANDARD_TIME_PER_CASE) {
            if (!belowStandardMetrics.tiempoPorCaso) {
                belowStandardMessages.push(`Tiempo promedio por caso (${tiempoPromedio} seg) por encima del estándar (${STANDARD_TIME_PER_CASE} seg)`);
                belowStandardMetrics.tiempoPorCaso = true;
                anyBelowStandard = true;
            }
        } else {
            belowStandardMetrics.tiempoPorCaso = false;
        }

        // Verificar tiempo promedio por caso gestionado
        if (tiempoPromedioGestionado > 0 && tiempoPromedioGestionado >= STANDARD_TIME_PER_MANAGED) {
            if (!belowStandardMetrics.tiempoPorGestionado) {
                belowStandardMessages.push(`Tiempo promedio por caso gestionado (${tiempoPromedioGestionado} seg) por encima del estándar (${STANDARD_TIME_PER_MANAGED} seg)`);
                belowStandardMetrics.tiempoPorGestionado = true;
                anyBelowStandard = true;
            }
        } else {
            belowStandardMetrics.tiempoPorGestionado = false;
        }

        // Verificar porcentaje de resolución (si hay casos gestionados)
        if (managedCount > 0 && resolutionPercentage < STANDARD_RESOLUTION_PERCENTAGE) {
            if (!belowStandardMetrics.resolution) {
                belowStandardMessages.push(`Porcentaje de resolución (${resolutionPercentage}%) por debajo del estándar (${STANDARD_RESOLUTION_PERCENTAGE}%)`);
                belowStandardMetrics.resolution = true;
                anyBelowStandard = true;
            }
        } else {
            belowStandardMetrics.resolution = false;
        }

        // Enviar notificación si hay métricas por debajo del estándar
        if (anyBelowStandard) {
            const title = "¡Alerta de Rendimiento!";
            const message = belowStandardMessages.join("\n");
            sendNotification(title, message);
        }
    }

    // Función para actualizar estadísticas
    function updateStats() {
        // Porcentaje de cierre
        const percentage = managedCount > 0 ? ((closedCount / managedCount) * 100).toFixed(1) : 0;
        closeRate.textContent = percentage + '%';

        // Porcentaje de resolución
        const resolution = managedCount > 0 ? (((managedCount - techniciansCount) / managedCount) * 100).toFixed(1) : 0;
        resolutionRateDisplay.textContent = resolution + '%';
        techniciansCountDisplay.textContent = techniciansCount;

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

            managedPerHour = totalHours > 0 ? (managedCount / totalHours).toFixed(1) : 0;
            // Removed avgManaged update as per user request (redundant with casesPerHour)

            // Tiempo promedio por caso cerrado (en segundos)
            const tiempoPromedio = calcularTiempoPromedioPorCaso();
            tiempoPorCaso.textContent = tiempoPromedio;

            // Tiempo promedio por caso gestionado (en segundos)
            const tiempoPromedioGestionado = calcularTiempoPromedioPorGestionado();
            tiempoPorGestionado.textContent = tiempoPromedioGestionado;

            // Actualizar indicadores de estándares
            actualizarIndicadoresEstandares(closedPerHour, managedPerHour, resolution);
        }

        // Actualizar estado de botones
        actualizarEstadoBotones();
    }

    // Función para actualizar los indicadores de estándares
    function actualizarIndicadoresEstandares(closedPerHour, managedPerHour, resolutionPercentage) {
        // Verificar estándar para casos cerrados
        if (closedPerHour >= STANDARD_CLOSED_PER_HOUR) {
            avgClosed.classList.remove('stat-below-standard');
            avgClosed.classList.add('stat-meets-standard');
            standardAvgClosed.classList.remove('standard-below');
            standardAvgClosed.classList.add('standard-meets');
            standardAvgClosed.textContent = "CUMPLE CON LA MÉTRICA";
        } else {
            avgClosed.classList.remove('stat-meets-standard');
            avgClosed.classList.add('stat-below-standard');
            standardAvgClosed.classList.remove('standard-meets');
            standardAvgClosed.classList.add('standard-below');
            standardAvgClosed.textContent = "NO CUMPLE LA MÉTRICA";
        }

        // Verificar estándar para casos totales por hora
        if (managedPerHour >= STANDARD_MANAGED_PER_HOUR) {
            casesPerHour.classList.remove('stat-below-standard');
            casesPerHour.classList.add('stat-meets-standard');
            standardCasesPerHour.classList.remove('standard-below');
            standardCasesPerHour.classList.add('standard-meets');
            standardCasesPerHour.textContent = "CUMPLE CON LA MÉTRICA";
        } else {
            casesPerHour.classList.remove('stat-meets-standard');
            casesPerHour.classList.add('stat-below-standard');
            standardCasesPerHour.classList.remove('standard-meets');
            standardCasesPerHour.classList.add('standard-below');
            standardCasesPerHour.textContent = "NO CUMPLE LA MÉTRICA";
        }

        // Verificar estándar para tiempo por caso
        const tiempoPromedio = calcularTiempoPromedioPorCaso();
        if (tiempoPromedio > 0 && tiempoPromedio < STANDARD_TIME_PER_CASE) {
            tiempoPorCaso.classList.remove('stat-below-standard');
            tiempoPorCaso.classList.add('stat-meets-standard');
            standardTiempoPorCaso.classList.remove('standard-below');
            standardTiempoPorCaso.classList.add('standard-meets');
            standardTiempoPorCaso.textContent = "CUMPLE CON LA MÉTRICA";
        } else if (tiempoPromedio > 0) {
            tiempoPorCaso.classList.remove('stat-meets-standard');
            tiempoPorCaso.classList.add('stat-below-standard');
            standardTiempoPorCaso.classList.remove('standard-meets');
            standardTiempoPorCaso.classList.add('standard-below');
            standardTiempoPorCaso.textContent = "NO CUMPLE LA MÉTRICA";
        }

        // Verificar estándar para tiempo por caso gestionado
        const tiempoPromedioGestionado = calcularTiempoPromedioPorGestionado();
        if (tiempoPromedioGestionado > 0 && tiempoPromedioGestionado < STANDARD_TIME_PER_MANAGED) {
            tiempoPorGestionado.classList.remove('stat-below-standard');
            tiempoPorGestionado.classList.add('stat-meets-standard');
            standardTiempoPorGestionado.classList.remove('standard-below');
            standardTiempoPorGestionado.classList.add('standard-meets');
            standardTiempoPorGestionado.textContent = "CUMPLE CON LA MÉTRICA";
        } else if (tiempoPromedioGestionado > 0) {
            tiempoPorGestionado.classList.remove('stat-meets-standard');
            tiempoPorGestionado.classList.add('stat-below-standard');
            standardTiempoPorGestionado.classList.remove('standard-meets');
            standardTiempoPorGestionado.classList.add('standard-below');
            standardTiempoPorGestionado.textContent = "NO CUMPLE LA MÉTRICA";
        }

        // Verificar estándar para porcentaje de resolución
        if (managedCount > 0) {
            if (parseFloat(resolutionPercentage) >= STANDARD_RESOLUTION_PERCENTAGE) {
                resolutionRateDisplay.classList.remove('stat-below-standard');
                resolutionRateDisplay.classList.add('stat-meets-standard');
                standardResolutionRate.classList.remove('standard-below');
                standardResolutionRate.classList.add('standard-meets');
                standardResolutionRate.textContent = "CUMPLE CON LA MÉTRICA";
            } else {
                resolutionRateDisplay.classList.remove('stat-meets-standard');
                resolutionRateDisplay.classList.add('stat-below-standard');
                standardResolutionRate.classList.remove('standard-meets');
                standardResolutionRate.classList.add('standard-below');
                standardResolutionRate.textContent = "NO CUMPLE LA MÉTRICA";
            }
        } else {
            // Reset if no managed cases
            resolutionRateDisplay.classList.remove('stat-below-standard', 'stat-meets-standard');
            standardResolutionRate.classList.remove('standard-below', 'standard-meets');
            standardResolutionRate.textContent = "--";
        }

        // Verificar métricas y enviar notificaciones si es necesario
        checkMetricsAndNotify(closedPerHour, managedPerHour, tiempoPromedio, tiempoPromedioGestionado, resolutionPercentage);
    }

    // Función para actualizar el temporizador
    function updateTimer() {
        // Calcular el tiempo transcurrido basado en la hora actual REAL
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
    btnTimer.addEventListener('click', function () {
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
    btnClosed.addEventListener('click', function () {
        if (closedCount < managedCount) {
            closedCount++;
            casesClosed.textContent = closedCount;
            updateStats();
            actualizarEstadoBotones(); // Asegurar que el estado del botón se actualice correctamente
        } else {
            mostrarError("No puedes cerrar más casos de los que has gestionado");
        }
    });

    // Evento para RESTAR caso cerrado
    btnSubtractClosed.addEventListener('click', function () {
        if (closedCount > 0) {
            closedCount--;
            casesClosed.textContent = closedCount;
            updateStats();
            actualizarEstadoBotones();
        }
    });

    // Evento para añadir caso gestionado
    btnManaged.addEventListener('click', function () {
        managedCount++;
        managedTimestamps.push(new Date()); // Registrar marca de tiempo
        casesManaged.textContent = managedCount;
        updateStats();
        actualizarEstadoBotones();
        updateChartData(); // Actualizar gráfica
    });

    // Evento para RESTAR caso gestionado
    btnSubtractManaged.addEventListener('click', function () {
        if (managedCount > 0) {
            // Final check
            if (managedCount - 1 >= closedCount) {
                managedCount--;
                managedTimestamps.pop(); // Eliminar última marca de tiempo (asumiendo corrección del último)
                casesManaged.textContent = managedCount;
                updateStats();
                actualizarEstadoBotones();
                updateChartData(); // Actualizar gráfica
            } else {
                mostrarError("No puedes tener menos casos gestionados que cerrados. Resta un caso cerrado primero.");
            }
        }
    });

    // Evento para añadir técnico
    btnTechnicians.addEventListener('click', function () {
        if (managedCount > 0 && techniciansCount < managedCount) {
            techniciansCount++;
            updateStats();
            actualizarEstadoBotones();
        } else if (managedCount === 0) {
            mostrarError("No puedes enviar técnicos si no hay casos gestionados.");
        } else {
            // Optional: Error if trying to add more technicians than cases
            mostrarError("No puedes enviar más técnicos que casos gestionados.");
        }
    });

    // Evento para RESTAR técnico
    btnSubtractTechnicians.addEventListener('click', function () {
        if (techniciansCount > 0) {
            techniciansCount--;
            updateStats();
            actualizarEstadoBotones();
        }
    });

    // Evento para reiniciar
    btnReset.addEventListener('click', function () {
        // Reiniciar contadores
        closedCount = 0;
        managedCount = 0;
        techniciansCount = 0;
        managedTimestamps = []; // Reiniciar timestamps

        // Reiniciar variables de tiempo
        clearInterval(timerInterval);
        timerRunning = false;
        startTime = 0;
        pausedTime = 0;
        seconds = 0;
        minutes = 0;
        hours = 0;

        // Actualizar la interfaz
        casesClosed.textContent = '0';
        casesManaged.textContent = '0';
        closeRate.textContent = '0%';
        casesPerHour.textContent = '0';
        avgClosed.textContent = '0';
        tiempoPorCaso.textContent = '0';
        tiempoPorGestionado.textContent = '0';
        techniciansCountDisplay.textContent = '0';
        resolutionRateDisplay.textContent = '0%';
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
        standardAvgClosed.textContent = "NO CUMPLE LA MÉTRICA";

        standardAvgClosed.textContent = "NO CUMPLE LA MÉTRICA";

        casesPerHour.classList.remove('stat-meets-standard');
        casesPerHour.classList.add('stat-below-standard');
        standardCasesPerHour.classList.remove('standard-meets');
        standardCasesPerHour.classList.add('standard-below');
        standardCasesPerHour.textContent = "NO CUMPLE LA MÉTRICA";

        tiempoPorCaso.classList.remove('stat-meets-standard');
        tiempoPorCaso.classList.add('stat-below-standard');
        standardTiempoPorCaso.classList.remove('standard-meets');
        standardTiempoPorCaso.classList.add('standard-below');
        standardTiempoPorCaso.textContent = "NO CUMPLE LA MÉTRICA";

        tiempoPorGestionado.classList.remove('stat-meets-standard');
        tiempoPorGestionado.classList.add('stat-below-standard');
        standardTiempoPorGestionado.classList.remove('standard-meets');
        standardTiempoPorGestionado.classList.add('standard-below');
        standardTiempoPorGestionado.textContent = "NO CUMPLE LA MÉTRICA";

        resolutionRateDisplay.classList.remove('stat-meets-standard');
        resolutionRateDisplay.classList.remove('stat-below-standard');
        standardResolutionRate.classList.remove('standard-meets');
        standardResolutionRate.classList.remove('standard-below');
        standardResolutionRate.textContent = "--";

        // Reiniciar variables de notificación
        belowStandardMetrics = {
            closed: false,
            managed: false,
            total: false,
            tiempoPorCaso: false,
            tiempoPorGestionado: false,
            resolution: false
        };

        actualizarEstadoBotones();
        updateChartData(); // Reiniciar gráfica
    });

    // Evento para inicializar estado de botones
    actualizarEstadoBotones();

    /* --- MODAL LOGIC --- */
    const editTimeModal = document.getElementById('editTimeModal');
    const btnEditTime = document.getElementById('btnEditTime');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    const btnSaveTime = document.getElementById('btnSaveTime');
    const inputHours = document.getElementById('inputHours');
    const inputMinutes = document.getElementById('inputMinutes');
    const inputSeconds = document.getElementById('inputSeconds');

    function openModal() {
        // Populate inputs with current time
        inputHours.value = hours;
        inputMinutes.value = minutes;
        inputSeconds.value = seconds;
        editTimeModal.classList.add('active');
    }

    function closeModal() {
        editTimeModal.classList.remove('active');
    }

    function saveNewTime() {
        const h = parseInt(inputHours.value) || 0;
        const m = parseInt(inputMinutes.value) || 0;
        const s = parseInt(inputSeconds.value) || 0;

        // Validation limits
        const safeH = Math.max(0, h);
        const safeM = Math.max(0, Math.min(59, m));
        const safeS = Math.max(0, Math.min(59, s));

        // Update global time variables
        hours = safeH;
        minutes = safeM;
        seconds = safeS;

        // Calculate total elapsed time in milliseconds
        const totalMilliseconds = (hours * 3600 * 1000) + (minutes * 60 * 1000) + (seconds * 1000);

        if (timerRunning) {
            // If running, we shift the startTime so the elapsed time matches our new input relative to NOW
            startTime = Date.now() - totalMilliseconds;
        } else {
            // If paused, we just set the accumulated paused time
            pausedTime = totalMilliseconds;
            startTime = 0; // Reset start time reference as we are paused
        }

        // Force UI update immediately
        const formattedTime = [
            hours.toString().padStart(2, "0"),
            minutes.toString().padStart(2, "0"),
            seconds.toString().padStart(2, "0")
        ].join(":");
        timer.textContent = formattedTime;

        // Update stats with new time
        updateStats();

        // Forzar actualización de la gráfica para asegurar consistencia visual
        if (typeof updateChartData === 'function') {
            updateChartData();
        }

        closeModal();
    }

    btnEditTime.addEventListener('click', openModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelEdit.addEventListener('click', closeModal);
    btnSaveTime.addEventListener('click', saveNewTime);

    // Close modal on outside click
    editTimeModal.addEventListener('click', function (e) {
        if (e.target === editTimeModal) {
            closeModal();
        }
    });

    /* --- GOOGLE SHEETS LOGIC --- */
    const configModal = document.getElementById('configModal');
    const btnConfig = document.getElementById('btnConfig');
    const btnCloseConfig = document.getElementById('btnCloseConfig');
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    const inputWebAppUrl = document.getElementById('inputWebAppUrl');
    const btnSaveData = document.getElementById('btnSaveData');
    const mensajeSuccess = document.getElementById('mensajeSuccess');

    // Load URL from local storage
    let savedWebAppUrl = localStorage.getItem('googleSheetWebAppUrl') || '';

    function openConfig() {
        inputWebAppUrl.value = savedWebAppUrl;
        configModal.classList.add('active');
    }

    function closeConfig() {
        configModal.classList.remove('active');
    }

    function saveConfig() {
        const url = inputWebAppUrl.value.trim();
        if (url) {
            localStorage.setItem('googleSheetWebAppUrl', url);
            savedWebAppUrl = url;
            closeConfig();
            alert('Configuración guardada correctamente.');
        } else {
            alert('Por favor introduce una URL válida.');
        }
    }

    btnConfig.addEventListener('click', openConfig);
    btnCloseConfig.addEventListener('click', closeConfig);
    btnSaveConfig.addEventListener('click', saveConfig);

    configModal.addEventListener('click', function (e) {
        if (e.target === configModal) {
            closeConfig();
        }
    });

    async function sendDataToSheet() {
        if (!savedWebAppUrl) {
            if (confirm("No has configurado la URL de Google Sheets. ¿Quieres configurarla ahora?")) {
                openConfig();
            }
            return;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES');
        const timeStr = now.toLocaleTimeString('es-ES');

        const dataPayload = {
            fecha: dateStr,
            horaGuardado: timeStr,
            tiempoTotal: timer.textContent,
            casosCerrados: casesClosed.textContent,
            casosGestionados: casesManaged.textContent,
            efectividad: closeRate.textContent,
            casosPorHora: casesPerHour.textContent,
            promedioCerrados: avgClosed.textContent,
            tmoCaso: tiempoPorCaso.textContent,
            tmoGestionado: tiempoPorGestionado.textContent,
            tecnicosEnviados: techniciansCountDisplay.textContent,
            porcentajeResolucion: resolutionRateDisplay.textContent
        };

        btnSaveData.textContent = "ENVIANDO...";
        btnSaveData.disabled = true;

        try {
            // Using no-cors mode for simple submission if the script doesn't handle CORS perfectly
            // Ideally, the script should return JSONP or handle CORS, but for simple logging:
            // Fetch POST usually works with text/plain body to avoid complexity of preflights in Apps Script

            await fetch(savedWebAppUrl, {
                method: 'POST',
                mode: 'no-cors', // Important for simple Apps Script web apps
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataPayload)
            });

            // Since no-cors returns opaque response, we assume success if no network error
            showMessage(mensajeSuccess);

        } catch (error) {
            console.error('Error:', error);
            mostrarError("Error al guardar datos. Revisa la consola.");
        } finally {
            btnSaveData.textContent = "GUARDAR EN SHEETS";
            btnSaveData.disabled = false;
        }
    }

    function showMessage(element) {
        element.classList.add('activo');
        setTimeout(() => {
            element.classList.remove('activo');
        }, 3000);
    }

    btnSaveData.addEventListener('click', sendDataToSheet);

    /* --- CHART LOGIC --- */
    function initChart() {
        const ctx = document.getElementById('casesChart').getContext('2d');

        // Plugin simple para dibujar etiquetas de datos encima de las barras
        const dataLabelsPlugin = {
            id: 'dataLabels',
            afterDatasetsDraw: (chart) => {
                const { ctx } = chart;

                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            // Obtener el valor
                            const data = dataset.data[index];
                            if (data === 0) return; // No dibujar si es 0 para limpieza

                            // Configuración de fuente y color
                            ctx.fillStyle = '#333333';
                            ctx.font = 'bold 12px Inter, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';

                            // Posición
                            const position = element.tooltipPosition();
                            // Dibujar texto un poco más arriba de la barra
                            ctx.fillText(data, position.x, position.y - 5);
                        });
                    }
                });
            }
        };

        const initialData = {
            labels: [],
            datasets: [{
                label: 'Casos Gestionados',
                data: [],
                backgroundColor: '#206bc4', // Azul sólido similar a la imagen
                borderColor: '#185196',
                borderWidth: 1,
                borderRadius: 2, // Ligero borde redondeado en la cima
                barPercentage: 0.6, // Ancho de las barras
                categoryPercentage: 0.8
            }]
        };

        const config = {
            type: 'bar',
            data: initialData,
            plugins: [dataLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true, // Mantener tooltips por si acaso
                        backgroundColor: '#333',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: {
                            label: function (context) {
                                return `Gestionados: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false, // Sin grid vertical
                            drawBorder: false
                        },
                        ticks: {
                            color: '#555',
                            font: {
                                size: 12
                            }
                        },
                        border: {
                            display: true,
                            color: '#ccc'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e5e5e5', // Líneas horizontales suaves
                            drawBorder: false,
                        },
                        ticks: {
                            stepSize: 1,
                            color: '#777',
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 20 // Espacio extra arriba para las etiquetas
                    }
                }
            }
        };

        casesChart = new Chart(ctx, config);
        updateChartData();
    }

    function updateChartData() {
        if (!casesChart) return;

        // Determinar hora de inicio basado SOLO en los registros reales
        // Esto evita que editar el tiempo (afectar startTime) deforme la gráfica visualmente con horas vacías
        let startTimestamp;

        if (managedTimestamps.length > 0) {
            startTimestamp = managedTimestamps[0].getTime();
        } else {
            startTimestamp = Date.now();
        }

        // Redondear a la hora :00 anterior
        if (!startTimestamp || isNaN(startTimestamp)) startTimestamp = Date.now();

        let startDate = new Date(startTimestamp);
        startDate.setMinutes(0, 0, 0);

        let endDate = new Date(); // Ahora

        // Generar buckets por hora
        let labels = [];
        let data = [];

        // Iterar hora por hora desde startDate hasta ahora
        let currentHour = new Date(startDate);

        // Asegurarnos de que al menos mostramos la hora actual
        while (currentHour <= endDate || labels.length === 0) {
            // Formato HH:00
            let label = currentHour.getHours().toString().padStart(2, '0') + ":00";
            labels.push(label);

            // Contar casos en esta hora
            // Un caso pertenece a esta hora si: currentHour <= timestamp < currentHour + 1h
            let nextHour = new Date(currentHour);
            nextHour.setHours(currentHour.getHours() + 1);

            let count = managedTimestamps.filter(ts => {
                let t = new Date(ts);
                return t >= currentHour && t < nextHour;
            }).length;

            data.push(count); // 'Promedio' por hora es el conteo en esa hora

            // Avanzar iterador
            currentHour.setHours(currentHour.getHours() + 1);

            // Safety break para evitar bucles infinitos en casos raros
            if (labels.length > 24) break;
        }

        casesChart.data.labels = labels;
        casesChart.data.datasets[0].data = data;
        casesChart.update();
    }

    // Inicializar gráfica
    initChart();
});