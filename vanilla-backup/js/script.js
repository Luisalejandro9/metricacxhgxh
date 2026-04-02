document.addEventListener('DOMContentLoaded', function () {
    const SUPABASE_URL = SUPABASE_CONFIG.URL;
    const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Elementos del dom 
    const btnLoginGoogle = document.getElementById('btnLoginGoogle');
    const btnLogout = document.getElementById('btnLogout');
    const loginOverlay = document.getElementById('loginOverlay');
    const userInfo = document.getElementById('userInfo');
    const userEmailSpan = document.getElementById('userEmail');
    
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

    let currentUser = null;

    // Variables Gráfica
    let casesChart = null;
    let managedTimestamps = [];

    // Estándares definidos
    const STANDARD_MANAGED_PER_HOUR = 3.78;
    const STANDARD_CLOSED_PER_HOUR = 3.78;
    const STANDARD_TIME_PER_CASE = 950; 
    const STANDARD_TIME_PER_MANAGED = 950; 
    const STANDARD_RESOLUTION_PERCENTAGE = 76.80;

    // --- SUPABASE AUTH LOGIC ---
    async function checkUser() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            handleLogin(session.user);
        } else {
            handleLogout();
        }
    }

    function handleLogin(user) {
        currentUser = user;
        loginOverlay.classList.remove('active');
        userInfo.style.display = 'flex';
        userEmailSpan.textContent = user.email;
        btnSaveData.style.opacity = '1';
        btnSaveData.style.cursor = 'pointer';
        btnSaveData.disabled = false;
    }

    function handleLogout() {
        currentUser = null;
        loginOverlay.classList.add('active');
        userInfo.style.display = 'none';
        btnSaveData.style.opacity = '0.5';
        btnSaveData.style.cursor = 'not-allowed';
        btnSaveData.disabled = true;
    }

    async function signInWithGoogle() {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) {
            console.error('Error signing in:', error.message);
            mostrarError('Error al iniciar sesión con Google.');
        }
    }

    async function signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('Error signing out:', error.message);
        }
    }

    // Auth Listeners
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            handleLogin(session.user);
        } else if (event === 'SIGNED_OUT') {
            handleLogout();
        }
    });

    btnLoginGoogle.addEventListener('click', signInWithGoogle);
    btnLogout.addEventListener('click', signOut);

    // Initial Check
    checkUser();

    // --- TRACKER LOGIC ---

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
        if (!("Notification" in window)) return;
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                notificationsEnabled = true;
            }
        });
    }

    // Función para enviar notificaciones
    function sendNotification(title, message) {
        if (!notificationsEnabled) return;
        new Notification(title, { body: message });
    }

    // Funciones de cálculo
    function calcularTiempoPromedioPorCaso() {
        if (closedCount === 0) return 0;
        const totalSeconds = seconds + (minutes * 60) + (hours * 3600);
        return Math.floor(totalSeconds / closedCount);
    }

    function calcularTiempoPromedioPorGestionado() {
        if (managedCount === 0) return 0;
        const totalSeconds = seconds + (minutes * 60) + (hours * 3600);
        return Math.floor(totalSeconds / managedCount);
    }

    function actualizarEstadoBotones() {
        if (!timerRunning) {
            [btnClosed, btnSubtractClosed, btnManaged, btnSubtractManaged, btnTechnicians, btnSubtractTechnicians].forEach(b => {
                b.classList.add('disabled');
                b.disabled = true;
            });
            return;
        }

        btnManaged.classList.remove('disabled');
        btnManaged.disabled = false;
        btnTechnicians.classList.remove('disabled');
        btnTechnicians.disabled = false;

        btnSubtractManaged.disabled = !(managedCount > 0 && (managedCount - 1) >= closedCount);
        btnSubtractManaged.classList.toggle('disabled', btnSubtractManaged.disabled);
        
        btnSubtractClosed.disabled = !(closedCount > 0);
        btnSubtractClosed.classList.toggle('disabled', btnSubtractClosed.disabled);

        btnClosed.disabled = !(closedCount < managedCount);
        btnClosed.classList.toggle('disabled', btnClosed.disabled);

        btnSubtractTechnicians.disabled = !(techniciansCount > 0);
        btnSubtractTechnicians.classList.toggle('disabled', btnSubtractTechnicians.disabled);
    }

    function checkMetricsAndNotify(closedPerHour, managedPerHour, tiempoPromedio, tiempoPromedioGestionado, resolutionPercentage) {
        if (!timerRunning || (hours === 0 && minutes < 5)) return;

        let messages = [];
        if (closedPerHour < STANDARD_CLOSED_PER_HOUR && !belowStandardMetrics.closed) {
            messages.push(`Cerrados/h (${closedPerHour}) bajo estándar`);
            belowStandardMetrics.closed = true;
        } else if (closedPerHour >= STANDARD_CLOSED_PER_HOUR) belowStandardMetrics.closed = false;

        if (managedPerHour < STANDARD_MANAGED_PER_HOUR && !belowStandardMetrics.managed) {
            messages.push(`Gestionados/h (${managedPerHour}) bajo estándar`);
            belowStandardMetrics.managed = true;
        } else if (managedPerHour >= STANDARD_MANAGED_PER_HOUR) belowStandardMetrics.managed = false;

        if (messages.length > 0) sendNotification("¡Alerta de Rendimiento!", messages.join("\n"));
    }

    function updateStats() {
        const percentage = managedCount > 0 ? ((closedCount / managedCount) * 100).toFixed(1) : 0;
        closeRate.textContent = percentage + '%';

        const resolution = managedCount > 0 ? (((managedCount - techniciansCount) / managedCount) * 100).toFixed(1) : 0;
        resolutionRateDisplay.textContent = resolution + '%';
        techniciansCountDisplay.textContent = techniciansCount;

        const totalSeconds = seconds + (minutes * 60) + (hours * 3600);
        const totalHours = totalSeconds / 3600;

        if (totalSeconds > 0) {
            const managedPerHour = (managedCount / totalHours).toFixed(1);
            casesPerHour.textContent = managedPerHour;

            const closedPerHour = (closedCount / totalHours).toFixed(1);
            avgClosed.textContent = closedPerHour;

            tiempoPorCaso.textContent = calcularTiempoPromedioPorCaso();
            tiempoPorGestionado.textContent = calcularTiempoPromedioPorGestionado();

            actualizarIndicadoresEstandares(parseFloat(closedPerHour), parseFloat(managedPerHour), resolution);
        }
        actualizarEstadoBotones();
    }

    function actualizarIndicadoresEstandares(closedPerHour, managedPerHour, resolutionPercentage) {
        const updateIndicator = (el, indicator, val, target, condition) => {
            const meets = condition ? val >= target : val <= target;
            el.classList.toggle('stat-meets-standard', meets);
            el.classList.toggle('stat-below-standard', !meets);
            indicator.classList.toggle('standard-meets', meets);
            indicator.classList.toggle('standard-below', !meets);
            indicator.textContent = meets ? "CUMPLE CON LA MÉTRICA" : "NO CUMPLE LA MÉTRICA";
        };

        updateIndicator(avgClosed, standardAvgClosed, closedPerHour, STANDARD_CLOSED_PER_HOUR, true);
        updateIndicator(casesPerHour, standardCasesPerHour, managedPerHour, STANDARD_MANAGED_PER_HOUR, true);
        
        const tmoC = calcularTiempoPromedioPorCaso();
        if (tmoC > 0) updateIndicator(tiempoPorCaso, standardTiempoPorCaso, tmoC, STANDARD_TIME_PER_CASE, false);
        
        const tmoG = calcularTiempoPromedioPorGestionado();
        if (tmoG > 0) updateIndicator(tiempoPorGestionado, standardTiempoPorGestionado, tmoG, STANDARD_TIME_PER_MANAGED, false);

        if (managedCount > 0) {
            updateIndicator(resolutionRateDisplay, standardResolutionRate, parseFloat(resolutionPercentage), STANDARD_RESOLUTION_PERCENTAGE, true);
        }
    }

    function updateTimer() {
        const currentTime = Date.now();
        const elapsedMilliseconds = currentTime - startTime + pausedTime;
        const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
        seconds = totalSeconds % 60;
        minutes = Math.floor(totalSeconds / 60) % 60;
        hours = Math.floor(totalSeconds / 3600);

        timer.textContent = [
            hours.toString().padStart(2, "0"),
            minutes.toString().padStart(2, "0"),
            seconds.toString().padStart(2, "0")
        ].join(":");
        updateStats();
    }

    btnTimer.addEventListener('click', function () {
        if (timerRunning) {
            clearInterval(timerInterval);
            pausedTime += Date.now() - startTime;
            btnTimer.textContent = "Iniciar Tiempo";
            mensajeInfo.style.display = "block";
        } else {
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
            btnTimer.textContent = "Detener Tiempo";
            mensajeInfo.style.display = "none";
            if (!notificationsEnabled) requestNotificationPermission();
        }
        timerRunning = !timerRunning;
        actualizarEstadoBotones();
    });

    btnClosed.addEventListener('click', () => { closedCount++; casesClosed.textContent = closedCount; updateStats(); });
    btnSubtractClosed.addEventListener('click', () => { if (closedCount > 0) { closedCount--; casesClosed.textContent = closedCount; updateStats(); } });
    btnManaged.addEventListener('click', () => { managedCount++; managedTimestamps.push(new Date()); casesManaged.textContent = managedCount; updateStats(); updateChartData(); });
    btnSubtractManaged.addEventListener('click', () => { if (managedCount > closedCount) { managedCount--; managedTimestamps.pop(); casesManaged.textContent = managedCount; updateStats(); updateChartData(); } });
    btnTechnicians.addEventListener('click', () => { if (techniciansCount < managedCount) { techniciansCount++; updateStats(); } });
    btnSubtractTechnicians.addEventListener('click', () => { if (techniciansCount > 0) { techniciansCount--; updateStats(); } });

    btnReset.addEventListener('click', function () {
        closedCount = managedCount = techniciansCount = 0;
        managedTimestamps = [];
        clearInterval(timerInterval);
        timerRunning = false;
        startTime = pausedTime = seconds = minutes = hours = 0;
        
        timer.textContent = '00:00:00';
        casesClosed.textContent = casesManaged.textContent = '0';
        updateStats();
        btnTimer.textContent = "Iniciar Tiempo";
        mensajeInfo.style.display = "block";
        updateChartData();
    });

    // Modal Logic
    const editTimeModal = document.getElementById('editTimeModal');
    const btnEditTime = document.getElementById('btnEditTime');
    const btnSaveTime = document.getElementById('btnSaveTime');
    const inputHours = document.getElementById('inputHours');
    const inputMinutes = document.getElementById('inputMinutes');
    const inputSeconds = document.getElementById('inputSeconds');

    btnEditTime.addEventListener('click', () => {
        inputHours.value = hours; inputMinutes.value = minutes; inputSeconds.value = seconds;
        editTimeModal.classList.add('active');
    });

    btnSaveTime.addEventListener('click', () => {
        hours = parseInt(inputHours.value) || 0;
        minutes = Math.min(59, parseInt(inputMinutes.value) || 0);
        seconds = Math.min(59, parseInt(inputSeconds.value) || 0);
        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        if (timerRunning) startTime = Date.now() - totalMs; else pausedTime = totalMs;
        updateTimer();
        editTimeModal.classList.remove('active');
    });

    document.getElementById('btnCloseModal').addEventListener('click', () => editTimeModal.classList.remove('active'));
    document.getElementById('btnCancelEdit').addEventListener('click', () => editTimeModal.classList.remove('active'));

    // --- SUPABASE SAVE LOGIC ---
    const btnSaveData = document.getElementById('btnSaveData');
    const mensajeSuccess = document.getElementById('mensajeSuccess');

    async function sendDataToSupabase() {
        if (!currentUser) {
            mostrarError("Debes iniciar sesión para guardar métricas.");
            return;
        }

        const dataPayload = {
            user_id: currentUser.id,
            date: new Date().toISOString().split('T')[0],
            total_time: timer.textContent,
            cases_closed: parseInt(casesClosed.textContent),
            cases_managed: parseInt(casesManaged.textContent),
            efficiency: parseFloat(closeRate.textContent),
            cases_per_hour: parseFloat(casesPerHour.textContent),
            avg_closed_per_hour: parseFloat(avgClosed.textContent),
            tmo_case: parseInt(tiempoPorCaso.textContent),
            tmo_managed: parseInt(tiempoPorGestionado.textContent),
            technicians_sent: parseInt(techniciansCountDisplay.textContent),
            resolution_rate: parseFloat(resolutionRateDisplay.textContent)
        };

        btnSaveData.textContent = "GUARDANDO...";
        btnSaveData.disabled = true;

        try {
            const { error } = await supabaseClient.from('daily_metrics').insert([dataPayload]);
            if (error) throw error;
            mensajeSuccess.classList.add('activo');
            setTimeout(() => mensajeSuccess.classList.remove('activo'), 3000);
        } catch (error) {
            console.error('Error:', error);
            mostrarError("Error al guardar: " + error.message);
        } finally {
            btnSaveData.textContent = "GUARDAR EN SUPABASE";
            btnSaveData.disabled = false;
        }
    }

    btnSaveData.addEventListener('click', sendDataToSupabase);

    // Chart Logic
    function initChart() {
        const ctx = document.getElementById('casesChart').getContext('2d');
        const dataLabelsPlugin = {
            id: 'dataLabels',
            afterDatasetsDraw: (chart) => {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            const data = dataset.data[index];
                            if (data === 0) return;
                            ctx.fillStyle = '#333';
                            ctx.font = 'bold 12px Inter';
                            ctx.textAlign = 'center';
                            const position = element.tooltipPosition();
                            ctx.fillText(data, position.x, position.y - 5);
                        });
                    }
                });
            }
        };

        casesChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Casos Gestionados', data: [], backgroundColor: '#206bc4', borderWidth: 1 }] },
            plugins: [dataLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
        updateChartData();
    }

    function updateChartData() {
        if (!casesChart) return;
        let startTimestamp = managedTimestamps.length > 0 ? managedTimestamps[0].getTime() : Date.now();
        let startDate = new Date(startTimestamp);
        startDate.setMinutes(0, 0, 0);
        let endDate = new Date();
        let labels = [], data = [], currentHour = new Date(startDate);

        while (currentHour <= endDate || labels.length === 0) {
            labels.push(currentHour.getHours().toString().padStart(2, '0') + ":00");
            let nextHour = new Date(currentHour);
            nextHour.setHours(currentHour.getHours() + 1);
            data.push(managedTimestamps.filter(ts => ts >= currentHour && ts < nextHour).length);
            currentHour.setHours(currentHour.getHours() + 1);
            if (labels.length > 24) break;
        }
        casesChart.data.labels = labels;
        casesChart.data.datasets[0].data = data;
        casesChart.update();
    }

    initChart();
});