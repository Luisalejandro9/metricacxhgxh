import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  BarChart3, 
  ArrowLeft, 
  Search, 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Database,
  RefreshCw,
  Trophy,
  TrendingUp,
  Flame,
  Calendar,
  Zap,
  Activity,
  History,
  ExternalLink,
  X,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const STANDARDS = {
  GXH_GREEN: 3.99,
  GXH_YELLOW: 3.78,
  RESOLUTION_GREEN: 78.10,
  CLOSED_GREEN: 78.8,
};

function AdminDashboard({ user, profile, setNetworkError }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [allMetrics, setAllMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('all');
  const [viewingUserDetails, setViewingUserDetails] = useState(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('email');
      
      if (usersError) throw usersError;
      setUsers(usersData || []);

      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: true });
      
      if (metricsError) throw metricsError;
      setAllMetrics(metricsData || []);

    } catch (error) {
      console.error('Error fetching admin data:', error.message);
      if (error.message.toLowerCase().includes('fetch')) {
        setNetworkError(true);
      }
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('admin_live_metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, (payload) => {
        setAllMetrics(currentMetrics => {
          if (payload.eventType === 'INSERT') return [...currentMetrics, payload.new].sort((a,b) => new Date(a.date) - new Date(b.date));
          if (payload.eventType === 'UPDATE') return currentMetrics.map(m => m.id === payload.new.id ? payload.new : m);
          if (payload.eventType === 'DELETE') {
             // BUG FIX: Must return elements that are NOT the deleted one
             return currentMetrics.filter(m => m.id !== payload.old.id);
          }
          return currentMetrics;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [setNetworkError]);

  const filteredMetrics = useMemo(() => {
    let filtered = [...allMetrics];
    if (selectedUserEmail !== 'all') {
      const userObj = users.find(u => u.email === selectedUserEmail);
      if (userObj) filtered = filtered.filter(m => m.user_id === userObj.id);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => users.find(u => u.id === m.user_id)?.email.toLowerCase().includes(term));
    }
    return filtered;
  }, [allMetrics, selectedUserEmail, users, searchTerm]);

  // SPLIT METRICS: Today's detailed monitor
  const metricsToday = useMemo(() => filteredMetrics.filter(m => m.date === todayStr), [filteredMetrics, todayStr]);

  // UNIFIED USER HISTORY (Accumulated)
  const unifiedHistory = useMemo(() => {
    return users.map(u => {
        const userRows = allMetrics.filter(m => m.user_id === u.id);
        if (userRows.length === 0) return null;
        
        const totalManaged = userRows.reduce((s, m) => s + (m.cases_managed || 0), 0);
        const totalClosed = userRows.reduce((s, m) => s + (m.cases_closed || 0), 0);
        const totalTechs = userRows.reduce((s, m) => s + (m.technicians_sent || 0), 0);
        const avgGxh = userRows.length > 0 ? (userRows.reduce((s,m) => s + (parseFloat(m.cases_per_hour) || 0), 0) / userRows.length).toFixed(2) : "0.00";
        const efficiency = totalManaged > 0 ? ((totalClosed / totalManaged) * 100).toFixed(1) : "0.0";
        const resolution = totalManaged > 0 ? (userRows.reduce((s,m) => s + (parseFloat(m.resolution_rate) || 0), 0) / userRows.length).toFixed(1) : "0.0";

        return {
            ...u,
            totalManaged,
            totalClosed,
            totalTechs,
            avgGxh,
            efficiency,
            resolution,
            recordsCount: userRows.length,
            rows: userRows.sort((a,b) => new Date(b.date) - new Date(a.date)) // Detailed sorted by date descending
        };
    }).filter(Boolean);
  }, [allMetrics, users]);

  const statsSummary = useMemo(() => {
    if (filteredMetrics.length === 0) return { totalManaged: 0, totalClosed: 0, totalTechs: 0, avgEfficiency: "0.0" };
    const totalManaged = filteredMetrics.reduce((sum, m) => sum + (m.cases_managed || 0), 0);
    const totalClosed = filteredMetrics.reduce((sum, m) => sum + (m.cases_closed || 0), 0);
    const totalTechs = filteredMetrics.reduce((sum, m) => sum + (m.technicians_sent || 0), 0);
    return {
      totalManaged,
      totalClosed,
      totalTechs,
      avgEfficiency: totalManaged > 0 ? ((totalClosed / totalManaged) * 100).toFixed(1) : "0.0"
    };
  }, [filteredMetrics]);

  const leaderboard = useMemo(() => {
    const list = unifiedHistory.sort((a,b) => parseFloat(b.efficiency) - parseFloat(a.efficiency));
    return list.slice(0, 5);
  }, [unifiedHistory]);

  const trendChartData = useMemo(() => {
    const dates = [...new Set(filteredMetrics.map(m => m.date))].slice(-7);
    const managedData = dates.map(d => filteredMetrics.filter(m => m.date === d).reduce((s,m) => s + (m.cases_managed || 0), 0));
    const closedData = dates.map(d => filteredMetrics.filter(m => m.date === d).reduce((s,m) => s + (m.cases_closed || 0), 0));
    return {
      labels: dates.map(d => d.split('-').slice(1).reverse().join('/')),
      datasets: [
        { label: 'Gestionados', data: managedData, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4, fill: true },
        { label: 'Cerrados', data: closedData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true }
      ]
    };
  }, [filteredMetrics]);

  const heatmapData = useMemo(() => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const distribution = days.map((day, idx) => {
        const matchingRecords = filteredMetrics.filter(m => new Date(m.date + 'T00:00:00').getDay() === idx);
        return matchingRecords.reduce((s,m) => s + (m.cases_managed || 0), 0);
    });
    return {
      labels: days,
      datasets: [{
        label: 'Cant. Gestión',
        data: distribution,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderRadius: 8,
      }]
    };
  }, [filteredMetrics]);

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return 'N/A';
    }
  };

  // ACCESS DENIED VIEW WITH REDIRECT
  const [countdown, setCountdown] = useState(15);
  
  useEffect(() => {
    if (!loading && (!profile || profile.role !== 'admin' || !profile.is_enabled)) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [loading, profile, navigate]);

  if (loading) {
    return (
      <div className="login-overlay">
        <div className="login-card" style={{textAlign:'center', padding:'40px'}}>
          <RefreshCw size={48} className="spinning text-primary" style={{marginBottom:20}} />
          <p>Verificando credenciales de administrador...</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin' || !profile.is_enabled) {
    return (
      <div className="login-overlay access-denied-bg">
        <div className="login-card" style={{textAlign:'center', maxWidth:'400px', border:'1px solid rgba(239, 68, 68, 0.2)'}}>
          <div style={{position:'relative', width:'fit-content', margin:'0 auto 24px'}}>
             <div className="pulse-circle" style={{position:'absolute', inset:'-10px', background:'rgba(239, 68, 68, 0.1)', borderRadius:'50%', animation:'ping 2s infinite'}}></div>
             <AlertCircle size={64} className="text-secondary" style={{color: 'var(--accent-error)', position:'relative'}} />
          </div>
          <h1 style={{fontSize:'28px', color:'var(--text-bright)', marginBottom:'10px'}}>¡No tienes acceso!</h1>
          <p style={{color:'var(--text-dim)', marginBottom:'30px', lineHeight:'1.5'}}>Tu cuenta no cuenta con permisos administrativos o ha sido desahibilitada.</p>
          
          <div style={{background:'rgba(239, 68, 68, 0.05)', padding:'15px', borderRadius:'12px', border:'1px solid rgba(239, 68, 68, 0.1)', marginBottom:'25px'}}>
             <p style={{fontSize:'12px', margin:0, color:'var(--text-dim)'}}>Redirigiendo automáticamente en</p>
             <div style={{fontSize:'32px', fontWeight:'800', color:'var(--accent-error)'}}>{countdown}s</div>
          </div>

          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{width:'100%'}}>
             <ArrowLeft size={16} /> Volver al Dashboard Ahora
          </button>
        </div>
        <style>{`
          .access-denied-bg {
             background: radial-gradient(circle at center, rgba(239, 68, 68, 0.05) 0%, #0a0b14 100%);
          }
          @keyframes ping {
            0% { transform: scale(1); opacity: 1; }
            70%, 100% { transform: scale(1.6); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <div style={{display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'10px'}}>
             <Database className="text-primary" size={24} />
             <h1 style={{margin:0}}>Admin Panel</h1>
          </div>
          <div className="subtitle">CONTROL CENTRAL</div>
        </header>

        <section className="user-info">
          <span>{user?.email}</span>
          <div style={{fontSize: '10px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>ADMINISTRADOR</div>
        </section>

        <nav className="action-section" style={{gap: '12px', flexGrow: 1, overflowY: 'auto', paddingRight: '5px'}}>
          <button className="btn btn-secondary" style={{width:'100%', marginBottom: '10px'}} onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Panel Usuario</button>
          
          <div>
             <h3 className="metric-label" style={{fontSize:'11px', marginBottom:'12px'}}><Trophy size={11} style={{marginRight:5}} /> Ranking Top Eficiencia</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom: '20px'}}>
                {leaderboard.map((u, i) => (
                  <div key={u.id} style={{
                    display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', borderRadius:'10px', 
                    background: i === 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid', borderColor: i === 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--border-light)'
                  }}>
                    <div style={{width:20, height:20, borderRadius:'50%', background: i === 0 ? 'var(--accent-warning)' : 'var(--border-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:'bold'}}>
                       {i === 0 ? <Zap size={10} color="white" /> : i+1}
                    </div>
                    <span style={{fontSize:11, fontWeight:'600', color: i === 0 ? 'var(--accent-warning)' : 'var(--text-bright)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexGrow: 1}}>{u.email.split('@')[0]}</span>
                    <span style={{fontSize:10, color:'var(--text-dim)'}}>{u.efficiency}%</span>
                  </div>
                ))}
             </div>
          </div>

          <div>
             <h3 className="metric-label" style={{fontSize:'11px', marginBottom:'12px'}}><Mail size={11} style={{marginRight:5}} /> Directorio</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                {users.map(u => (
                  <div key={u.id} className={`user-list-item ${selectedUserEmail === u.email ? 'active' : ''}`} onClick={() => setSelectedUserEmail(u.email)}
                    style={{
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid',
                      background: selectedUserEmail === u.email ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      borderColor: selectedUserEmail === u.email ? 'var(--primary-light)' : 'transparent',
                      color: selectedUserEmail === u.email ? 'var(--text-bright)' : 'var(--text-dim)'
                    }}
                  >
                    <div style={{width:6, height:6, borderRadius:'50%', background: u.is_enabled ? 'var(--accent-success)' : 'var(--text-dim)'}}></div>
                    <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.email}</span>
                  </div>
                ))}
                <div onClick={() => setSelectedUserEmail('all')} style={{
                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', textAlign: 'center', marginTop: '5px',
                    background: selectedUserEmail === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid', borderColor: selectedUserEmail === 'all' ? 'var(--primary-light)' : 'var(--border-light)'
                }}>Mostrar Global</div>
             </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="admin-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'30px'}}>
             <div>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                  <h2 style={{fontSize: '32px', margin: 0}}>Admin Panel</h2>
                  <div className="live-container" style={{display:'flex', alignItems:'center', gap:'8px', background:'rgba(239, 68, 68, 0.1)', padding:'6px 12px', borderRadius:'20px', border:'1px solid rgba(239, 68, 68, 0.2)'}}>
                    <div className="pulse-dot"></div>
                    <span style={{fontSize:'10px', fontWeight:'800', color:'var(--accent-error)', letterSpacing:'0.1em'}}>EN VIVO</span>
                  </div>
                </div>
                <p style={{color: 'var(--text-muted)', marginTop: '8px'}}>Gestionando {users.length} operadores activos</p>
             </div>
             
             <div style={{display:'flex', gap:'12px', alignItems:'center', width:'100%', maxWidth:'450px'}}>
                <div style={{position:'relative', flexGrow: 1}}>
                  <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)'}} />
                  <input type="text" placeholder="Filtrar por operador..." className="filter-input" style={{width:'100%', paddingLeft:'40px', height:'45px', borderRadius:'12px'}} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button className="btn btn-secondary" onClick={() => fetchData(true)} disabled={isRefreshing} style={{height: '45px', width: '45px', padding:0, borderRadius: '12px'}}><RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} /></button>
             </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid-secondary" style={{marginBottom: '30px'}}>
          <div className="metric-card">
            <span className="metric-label">Gestionados Acum.</span>
            <div className="metric-value medium">{statsSummary.totalManaged}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cerrados Acum.</span>
            <div className="metric-value medium">{statsSummary.totalClosed}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">TCO Acum.</span>
            <div className="metric-value medium">{statsSummary.totalTechs}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Eficiencia Media</span>
            <div className={`metric-value medium ${getStatusClass(statsSummary.avgEfficiency, 78.8, 76.8)}`}>{statsSummary.avgEfficiency}%</div>
          </div>
        </div>

        {/* MONITOR JORNADA ACTUAL (LIVE) */}
        <div className="metric-card" style={{padding: '0', marginBottom: '32px', border: '1px solid rgba(255,255,255,0.05)'}}>
            <div className="table-header" style={{padding: '20px 32px', borderBottom:'1px solid var(--border-light)', background: 'rgba(99, 102, 241, 0.05)'}}>
               <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <Activity size={16} className="text-primary" />
                  <span className="metric-label" style={{margin:0, color: 'var(--text-bright)'}}>Monitor de Jornada Actual (Hoy)</span>
               </div>
               <div style={{fontSize:'10px', color:'var(--accent-success)', fontWeight:'bold'}}>AUTOSINCRONIZADO</div>
            </div>
            <div className="table-container" style={{maxHeight:'350px'}}>
                <table className="history-table admin-table">
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', paddingLeft:'32px'}}>Operador</th>
                      <th>Gest.</th>
                      <th>Cerr.</th>
                      <th>TCO</th>
                      <th>% Cierre</th>
                      <th>Acum. Reso</th>
                      <th>G/h</th>
                      <th>Última Act.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsToday.length === 0 ? (
                      <tr><td colSpan="8" style={{padding: '30px', textAlign:'center', color:'var(--text-dim)'}}>No hay actividad registrada para hoy.</td></tr>
                    ) : metricsToday.map((item) => {
                      const email = users.find(u => u.id === item.user_id)?.email || 'N/A';
                      return (
                        <tr key={item.id}>
                          <td style={{textAlign:'left', paddingLeft:'32px'}}>
                            <div style={{display:'flex', flexDirection:'column'}}>
                               <span style={{fontWeight:'700', color:'var(--text-bright)'}}>{email.split('@')[0]}</span>
                               <span style={{fontSize:'10px', color:'var(--text-dim)'}}>{email}</span>
                            </div>
                          </td>
                          <td>{item.cases_managed}</td>
                          <td>{item.cases_closed}</td>
                          <td>{item.technicians_sent}</td>
                          <td className={getStatusClass(item.efficiency, 78.8, 76.8)}>{item.efficiency}%</td>
                          <td className={getStatusClass(item.resolution_rate, 78.10, 76.8)}>{item.resolution_rate}%</td>
                          <td className={getStatusClass(item.cases_per_hour, 3.99, 3.78)}>{item.cases_per_hour}</td>
                          <td style={{fontSize: '11px', color: 'var(--text-dim)'}}>{formatLastUpdated(item.updated_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
        </div>

        {/* ANALYTICS ROW */}
        <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap:'24px', marginBottom:'32px'}}>
            <div className="metric-card" style={{padding: '24px'}}>
              <span className="metric-label"><TrendingUp size={14} style={{marginRight:5}} /> Tendencia Semanal</span>
              <div style={{height: '180px'}}><Line data={trendChartData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } }, plugins: { legend: { display: false } } }} /></div>
            </div>
            <div className="metric-card" style={{padding: '24px'}}>
              <span className="metric-label"><BarChart3 size={14} style={{marginRight:5}} /> Distribución Semanal</span>
              <div style={{height: '180px'}}><Bar data={heatmapData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } }, plugins: { legend: { display: false } } }} /></div>
            </div>
        </div>

        {/* UNIFIED HISTORY TABLE (Drill-down) */}
        <div className="metric-card" style={{padding: '0'}}>
            <div className="table-header" style={{padding: '20px 32px', borderBottom:'1px solid var(--border-light)'}}>
               <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <History size={16} className="text-secondary" />
                  <span className="metric-label" style={{margin:0, color: 'var(--text-bright)'}}>Historial Unificado de Operadores</span>
               </div>
               <div style={{fontSize:'10px', color:'var(--text-dim)'}}>Haz clic en un operador para ver su detalle</div>
            </div>
            <div className="table-container" style={{maxHeight:'500px'}}>
                <table className="history-table admin-table clickable-rows">
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', paddingLeft:'32px'}}>Operador</th>
                      <th>Días Reg.</th>
                      <th>Total Gest.</th>
                      <th>Total Cerr.</th>
                      <th>% Cierre Med.</th>
                      <th>% Reso Med.</th>
                      <th>G/h Med.</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedHistory.length === 0 ? (
                      <tr><td colSpan="8" style={{padding:'40px', textAlign:'center', color:'var(--text-dim)'}}>Iniciando base de datos...</td></tr>
                    ) : unifiedHistory.map((u) => (
                      <tr key={u.id} onClick={() => setViewingUserDetails(u)} style={{cursor: 'pointer'}}>
                        <td style={{textAlign:'left', paddingLeft:'32px'}}>
                            <div style={{display:'flex', flexDirection:'column'}}>
                               <span style={{fontWeight:'700', color:'var(--text-bright)'}}>{u.email.split('@')[0]}</span>
                               <span style={{fontSize:'10px', color:'var(--text-dim)'}}>{u.email}</span>
                            </div>
                        </td>
                        <td>{u.recordsCount}</td>
                        <td style={{fontWeight:'600'}}>{u.totalManaged}</td>
                        <td style={{fontWeight:'600'}}>{u.totalClosed}</td>
                        <td className={getStatusClass(u.efficiency, 78.8, 76.8)}>{u.efficiency}%</td>
                        <td className={getStatusClass(u.resolution, 78.10, 76.8)}>{u.resolution}%</td>
                        <td className={getStatusClass(u.avgGxh, 3.99, 3.78)}>{u.avgGxh}</td>
                        <td style={{color: 'var(--primary)'}}><div style={{display:'flex', alignItems:'center', gap:5, justifyContent:'center'}}>Ver <ChevronRight size={14}/></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
        </div>
      </main>

      {/* DRILL-DOWN MODAL: USER DETAILS */}
      {viewingUserDetails && (
        <div className="login-overlay drilldown-modal" style={{zIndex: 2000}}>
           <div className="login-card" style={{maxWidth: '900px', width: '95%', padding: '0', overflow:'hidden'}}>
              <header style={{padding: '24px 32px', background: 'var(--bg-glass)', borderBottom:'1px solid var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <div>
                    <h2 style={{margin:0, fontSize:'24px', color:'var(--text-bright)'}}>{viewingUserDetails.email.split('@')[0]}</h2>
                    <p style={{fontSize:'12px', color:'var(--text-muted)', margin:0}}>{viewingUserDetails.email}</p>
                 </div>
                 <button className="btn btn-secondary" onClick={() => setViewingUserDetails(null)} style={{padding:'8px'}}><X size={20}/></button>
              </header>
              
              <div style={{padding: '32px', maxHeight: '70vh', overflowY: 'auto'}}>
                 <div className="grid-secondary" style={{marginBottom: '32px'}}>
                    <div className="metric-card" style={{background:'rgba(255,255,255,0.02)'}}>
                        <span className="metric-label">Días de Actividad</span>
                        <div className="metric-value small">{viewingUserDetails.recordsCount}</div>
                    </div>
                    <div className="metric-card" style={{background:'rgba(255,255,255,0.02)'}}>
                        <span className="metric-label">Promedio G/h</span>
                        <div className="metric-value small">{viewingUserDetails.avgGxh}</div>
                    </div>
                    <div className="metric-card" style={{background:'rgba(255,255,255,0.02)'}}>
                        <span className="metric-label">Eficiencia Total</span>
                        <div className={`metric-value small ${getStatusClass(viewingUserDetails.efficiency, 78.8, 76.8)}`}>{viewingUserDetails.efficiency}%</div>
                    </div>
                 </div>

                 <h3 className="metric-label" style={{marginBottom: '15px'}}><Calendar size={14} style={{marginRight:8}}/> Desglose fecha por fecha</h3>
                 <table className="history-table admin-table">
                    <thead>
                       <tr>
                          <th>Fecha</th>
                          <th>T. Conexión</th>
                          <th>Gest.</th>
                          <th>Cerr.</th>
                          <th>TCO</th>
                          <th>% Cierre</th>
                          <th>Acum. Reso</th>
                          <th>G/h</th>
                       </tr>
                    </thead>
                    <tbody>
                       {viewingUserDetails.rows.map(row => (
                         <tr key={row.id}>
                            <td style={{fontWeight:'700'}}>{row.date}</td>
                            <td>{row.total_time}</td>
                            <td>{row.cases_managed}</td>
                            <td>{row.cases_closed}</td>
                            <td>{row.technicians_sent}</td>
                            <td className={getStatusClass(row.efficiency, 78.8, 76.8)}>{row.efficiency}%</td>
                            <td className={getStatusClass(row.resolution_rate, 78.10, 76.8)}>{row.resolution_rate}%</td>
                            <td className={getStatusClass(row.cases_per_hour, 3.99, 3.78)}>{row.cases_per_hour}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              
              <footer style={{padding: '20px 32px', textAlign: 'right', background:'rgba(0,0,0,0.1)', borderTop:'1px solid var(--border-light)'}}>
                  <button className="btn btn-primary" onClick={() => setViewingUserDetails(null)}>Cerrar Detalle</button>
              </footer>
           </div>
        </div>
      )}
      
      <style>{`
        .pulse-dot {
          width: 8px; height: 8px; background: var(--accent-error); border-radius: 50%;
          box-shadow: 0 0 0 rgba(239, 68, 68, 0.4); animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .clickable-rows tbody tr:hover {
           background: rgba(99, 102, 241, 0.05) !important;
        }
        .drilldown-modal {
           backdrop-filter: blur(8px);
           background: rgba(0,0,0,0.6);
        }
      `}</style>
    </div>
  );
}

export default AdminDashboard;
