import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Minus, 
  Save, 
  Clock, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const STANDARDS = {
  MANAGED_PER_HOUR: 3.78,
  CLOSED_PER_HOUR: 3.78,
  TIME_PER_CASE: 950,
  TIME_PER_MANAGED: 950,
  RESOLUTION_PERCENTAGE: 76.80
};

function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Metrics State
  const [closedCount, setClosedCount] = useState(0);
  const [managedCount, setManagedCount] = useState(0);
  const [techniciansCount, setTechniciansCount] = useState(0);
  const [managedTimestamps, setManagedTimestamps] = useState([]);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);

  // UI State
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [editTime, setEditTime] = useState({ h: 0, m: 0, s: 0 });
  const [message, setMessage] = useState({ type: null, text: '' });
  const [isSaving, setIsSaving] = useState(false);

  // --- Auth Logic ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) showMessage('error', 'Error al iniciar sesión: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- Timer Logic ---
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  const resetAll = () => {
    if (window.confirm('¿Estás seguro de reiniciar todos los contadores?')) {
      setClosedCount(0);
      setManagedCount(0);
      setTechniciansCount(0);
      setTimerSeconds(0);
      setManagedTimestamps([]);
      setIsTimerRunning(false);
      showMessage('info', 'Contadores reiniciados.');
    }
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  // --- Derived Metrics ---
  const stats = useMemo(() => {
    const totalHours = timerSeconds / 3600;
    const closeRate = managedCount > 0 ? (closedCount / managedCount) * 100 : 0;
    const resolutionRate = managedCount > 0 ? ((managedCount - techniciansCount) / managedCount) * 100 : 0;
    const managedPerHour = totalHours > 0 ? managedCount / totalHours : 0;
    const closedPerHour = totalHours > 0 ? closedCount / totalHours : 0;
    const tmoCase = closedCount > 0 ? Math.floor(timerSeconds / closedCount) : 0;
    const tmoManaged = managedCount > 0 ? Math.floor(timerSeconds / managedCount) : 0;

    return {
      closeRate: closeRate.toFixed(1),
      resolutionRate: resolutionRate.toFixed(1),
      managedPerHour: managedPerHour.toFixed(1),
      closedPerHour: closedPerHour.toFixed(1),
      tmoCase,
      tmoManaged
    };
  }, [closedCount, managedCount, techniciansCount, timerSeconds]);

  // --- Chart Logic ---
  const chartData = useMemo(() => {
    const labels = [];
    const data = [];
    const now = new Date();
    
    // Generate labels for the last 8 hours
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      const hourStr = d.getHours().toString().padStart(2, '0') + ':00';
      labels.push(hourStr);
      
      const count = managedTimestamps.filter(ts => {
        const tsDate = new Date(ts);
        return tsDate.getHours() === d.getHours() && tsDate.getDate() === d.getDate();
      }).length;
      data.push(count);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Casos Gestionados',
          data,
          backgroundColor: '#0033CC',
          borderColor: '#0033CC',
          borderWidth: 1,
        },
      ],
    };
  }, [managedTimestamps]);

  // --- Handlers ---
  const addManaged = () => {
    setManagedCount(prev => prev + 1);
    setManagedTimestamps(prev => [...prev, new Date().toISOString()]);
  };

  const subtractManaged = () => {
    if (managedCount > closedCount) {
      setManagedCount(prev => prev - 1);
      setManagedTimestamps(prev => prev.slice(0, -1));
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    if (type !== 'info') {
      setTimeout(() => setMessage({ type: null, text: '' }), 4000);
    }
  };

  const saveToSupabase = async () => {
    if (!user) return;
    setIsSaving(true);
    const payload = {
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      total_time: formatTime(timerSeconds),
      cases_closed: closedCount,
      cases_managed: managedCount,
      efficiency: parseFloat(stats.closeRate),
      cases_per_hour: parseFloat(stats.managedPerHour),
      avg_closed_per_hour: parseFloat(stats.closedPerHour),
      tmo_case: stats.tmoCase,
      tmo_managed: stats.tmoManaged,
      technicians_sent: techniciansCount,
      resolution_rate: parseFloat(stats.resolutionRate)
    };

    const { error } = await supabase.from('daily_metrics').insert([payload]);
    
    if (error) {
      showMessage('error', 'Error al guardar: ' + error.message);
    } else {
      showMessage('success', '¡Métricas guardadas correctamente!');
    }
    setIsSaving(false);
  };

  if (loading) return <div className="loading">Cargando...</div>;

  if (!user) {
    return (
      <div className="login-overlay active">
        <div className="login-card">
          <h1>SOPORTE MÉTRICAS</h1>
          <p>Herramienta interna de gestión de rendimiento</p>
          <button className="btn-google" onClick={handleGoogleLogin}>
            <img src="https://www.google.com/favicon.ico" alt="Google" />
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>Soporte GxH</h1>
          <div className="subtitle">PERFORMANCE TRACKER</div>
        </header>

        <section className="user-info">
          <span id="userEmail">{user.email}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Cerrar Sesión <LogOut size={10} style={{ marginLeft: 5 }} />
          </button>
        </section>

        <section className="timer-section">
          <div className="timer-display">{formatTime(timerSeconds)}</div>
          <div className="timer-controls">
            <button className={`btn btn-primary ${isTimerRunning ? 'active' : ''}`} onClick={toggleTimer}>
              {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
              <span style={{ marginLeft: 10 }}>{isTimerRunning ? 'Detener Tiempo' : 'Iniciar Tiempo'}</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setShowEditTimeModal(true)}>
              <Clock size={16} style={{ marginRight: 10 }} /> Editar Tiempo
            </button>
          </div>
        </section>

        <section className="action-section">
          <div className="action-row">
            <button className="btn btn-subtract" onClick={() => closedCount > 0 && setClosedCount(c => c - 1)} disabled={!isTimerRunning || closedCount === 0}>
              <Minus />
            </button>
            <button className="btn btn-action" onClick={() => setClosedCount(c => c + 1)} disabled={!isTimerRunning || closedCount >= managedCount}>
              <span className="btn-label">CASO CERRADO</span>
              <span className="btn-icon">✓</span>
            </button>
          </div>

          <div className="action-row">
            <button className="btn btn-subtract" onClick={subtractManaged} disabled={!isTimerRunning || managedCount <= closedCount}>
              <Minus />
            </button>
            <button className="btn btn-action" onClick={addManaged} disabled={!isTimerRunning}>
              <span className="btn-label">CASO GESTIONADO</span>
              <span className="btn-icon">+</span>
            </button>
          </div>

          <div className="action-row">
            <button className="btn btn-subtract" onClick={() => techniciansCount > 0 && setTechniciansCount(t => t - 1)} disabled={!isTimerRunning || techniciansCount === 0}>
              <Minus />
            </button>
            <button className="btn btn-action" onClick={() => techniciansCount < managedCount && setTechniciansCount(t => t + 1)} disabled={!isTimerRunning || techniciansCount >= managedCount}>
              <span className="btn-label">TCO ENVIADO</span>
              <span className="btn-icon">⚡</span>
            </button>
          </div>
          
          <button className="btn btn-secondary" onClick={resetAll}>
            <RotateCcw size={16} style={{ marginRight: 10 }} /> Reiniciar Todo
          </button>
        </section>

        <section className="standards-section">
          <h3>Estándares Requeridos</h3>
          <div className="standard-row"><span>Gestionados p/h</span> <span>{STANDARDS.MANAGED_PER_HOUR}</span></div>
          <div className="standard-row"><span>Cerrados p/h</span> <span>{STANDARDS.CLOSED_PER_HOUR}</span></div>
          <div className="standard-row"><span>TMO (segundos)</span> <span>{STANDARDS.TIME_PER_CASE}s</span></div>
          <div className="standard-row"><span>% Resolución</span> <span>{STANDARDS.RESOLUTION_PERCENTAGE}%</span></div>
        </section>

        <div className="sidebar-footer">Powered by Supabase & React</div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* MESSAGES */}
        {message.text && (
          <div className={`mensaje activo mensaje-${message.type}`}>
            {message.type === 'success' && <CheckCircle2 size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.type === 'error' && <AlertCircle size={18} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
            {message.text}
          </div>
        )}

        {timerSeconds === 0 && !isTimerRunning && (
          <div className="mensaje activo mensaje-info">
            Inicia el cronómetro para comenzar a registrar tus métricas de hoy.
          </div>
        )}

        <div className="grid-primary">
          <div className="metric-card large-card">
            <div>
              <span className="metric-label">Casos Cerrados Hoy</span>
              <div className="metric-value">{closedCount}</div>
            </div>
            <div className={`status-indicator ${parseFloat(stats.closedPerHour) >= STANDARDS.CLOSED_PER_HOUR ? 'standard-meets' : 'standard-below'}`}>
              {parseFloat(stats.closedPerHour) >= STANDARDS.CLOSED_PER_HOUR ? 'CUMPLE CON LA MÉTRICA' : 'NO CUMPLE LA MÉTRICA'}
            </div>
          </div>

          <div className="metric-card large-card">
            <div className="button-row" style={{ marginBottom: 20 }}>
              <button className="btn btn-save" onClick={saveToSupabase} disabled={isSaving || managedCount === 0}>
                {isSaving ? 'GUARDANDO...' : 'GUARDAR EN SUPABASE'}
              </button>
              <button className="btn btn-secondary btn-icon"><Save size={20} /></button>
            </div>
            <div>
              <span className="metric-label">Casos Gestionados</span>
              <div className="metric-value">{managedCount}</div>
            </div>
          </div>
        </div>

        <div className="grid-secondary">
          <div className="metric-card">
            <span className="metric-label">% Eficacia (Cerrados/Gest)</span>
            <div className="metric-value medium">{stats.closeRate}%</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Gestionados por Hora</span>
            <div className={`metric-value medium ${parseFloat(stats.managedPerHour) < STANDARDS.MANAGED_PER_HOUR ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.managedPerHour}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cerrados por Hora</span>
            <div className={`metric-value medium ${parseFloat(stats.closedPerHour) < STANDARDS.CLOSED_PER_HOUR ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.closedPerHour}
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO por Caso</span>
            <div className={`metric-value medium ${stats.tmoCase > STANDARDS.TIME_PER_CASE ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.tmoCase}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TMO por Gestión</span>
            <div className={`metric-value medium ${stats.tmoManaged > STANDARDS.TIME_PER_MANAGED ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.tmoManaged}s
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-label">% Resolución Real</span>
            <div className={`metric-value medium ${parseFloat(stats.resolutionRate) < STANDARDS.RESOLUTION_PERCENTAGE ? 'stat-below-standard' : 'stat-meets-standard'}`}>
              {stats.resolutionRate}%
            </div>
          </div>
        </div>

        <div className="metric-card" style={{ height: 300 }}>
          <span className="metric-label">Productividad por Horas</span>
          <Bar 
            data={chartData} 
            options={{ 
              responsive: true, 
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }} 
          />
        </div>
      </main>

      {/* EDIT TIME MODAL */}
      <div className={`modal-overlay ${showEditTimeModal ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h2>Editar Tiempo Transcurrido</h2>
            <button className="btn-close" onClick={() => setShowEditTimeModal(false)}><X /></button>
          </div>
          <div className="time-inputs">
            <div className="input-group">
              <label>Horas</label>
              <input type="number" value={editTime.h} onChange={e => setEditTime({...editTime, h: parseInt(e.target.value)})}/>
            </div>
            <div className="input-divider">:</div>
            <div className="input-group">
              <label>Minutos</label>
              <input type="number" value={editTime.m} onChange={e => setEditTime({...editTime, m: parseInt(e.target.value)})}/>
            </div>
            <div className="input-divider">:</div>
            <div className="input-group">
              <label>Segundos</label>
              <input type="number" value={editTime.s} onChange={e => setEditTime({...editTime, s: parseInt(e.target.value)})}/>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowEditTimeModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => {
              const total = editTime.h * 3600 + editTime.m * 60 + editTime.s;
              setTimerSeconds(total);
              setShowEditTimeModal(false);
            }}>Guardar Cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
