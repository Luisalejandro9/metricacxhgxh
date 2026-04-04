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
  Filter,
  RefreshCw,
  Trophy,
  TrendingUp,
  Flame,
  Calendar
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
        .order('date', { ascending: true }); // Ascending for time charts
      
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_metrics' },
        (payload) => {
          setAllMetrics(currentMetrics => {
            if (payload.eventType === 'INSERT') return [...currentMetrics, payload.new].sort((a,b) => new Date(a.date) - new Date(b.date));
            if (payload.eventType === 'UPDATE') return currentMetrics.map(m => m.id === payload.new.id ? payload.new : m);
            if (payload.eventType === 'DELETE') return currentMetrics.filter(m => m.id === payload.old.id);
            return currentMetrics;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [setNetworkError]);

  const filteredMetrics = useMemo(() => {
    let filtered = [...allMetrics].reverse(); // Table uses reverse chronological
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

  const getStatusClass = (value, greenTarget, yellowTarget) => {
    const val = parseFloat(value);
    if (val >= greenTarget) return 'stat-meets-standard';
    if (val >= yellowTarget) return 'stat-warning-standard';
    return 'stat-below-standard';
  };

  const statsSummary = useMemo(() => {
    if (allMetrics.length === 0) return null;
    const totalManaged = allMetrics.reduce((sum, m) => sum + (m.cases_managed || 0), 0);
    const totalClosed = allMetrics.reduce((sum, m) => sum + (m.cases_closed || 0), 0);
    return {
      totalManaged,
      totalClosed,
      avgEfficiency: ((totalClosed / totalManaged) * 100).toFixed(1),
      userCount: users.length
    };
  }, [allMetrics, users]);

  // --- Leaderboard Integration ---
  const leaderboard = useMemo(() => {
    const usersPerformance = users.map(u => {
      const userRows = allMetrics.filter(m => m.user_id === u.id);
      if (userRows.length === 0) return { ...u, totalManaged: 0, totalClosed: 0, efficiency: 0 };
      const totalManaged = userRows.reduce((s, m) => s + (m.cases_managed || 0), 0);
      const totalClosed = userRows.reduce((s, m) => s + (m.cases_closed || 0), 0);
      return {
        ...u,
        totalManaged,
        totalClosed,
        efficiency: totalManaged > 0 ? (totalClosed / totalManaged) * 100 : 0
      };
    }).sort((a,b) => b.efficiency - a.efficiency); // Rank by efficiency
    return usersPerformance.slice(0, 5); // Top 5
  }, [allMetrics, users]);

  // --- Productivity Trend (Weekly) ---
  const trendChartData = useMemo(() => {
    // Group metrics by day for everyone
    const dates = [...new Set(allMetrics.map(m => m.date))].slice(-7); // Last 7 days
    const managedData = dates.map(d => allMetrics.filter(m => m.date === d).reduce((s,m) => s + (m.cases_managed || 0), 0));
    const closedData = dates.map(d => allMetrics.filter(m => m.date === d).reduce((s,m) => s + (m.cases_closed || 0), 0));
    
    return {
      labels: dates.map(d => d.split('-').slice(1).reverse().join('/')), // Short date
      datasets: [
        { label: 'Gestionados', data: managedData, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4, fill: true },
        { label: 'Cerrados', data: closedData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true }
      ]
    };
  }, [allMetrics]);

  // --- Productivity Heatmap (By day of week) ---
  const heatmapData = useMemo(() => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const distribution = days.map((day, idx) => {
        const matchingRecords = allMetrics.filter(m => new Date(m.date + 'T00:00:00').getDay() === idx);
        return matchingRecords.length > 0 ? matchingRecords.reduce((s,m) => s + (m.cases_managed || 0), 0) : 0;
    });

    return {
      labels: days,
      datasets: [{
        label: 'Actividad Peak (Cant. Gestión)',
        data: distribution,
        backgroundColor: distribution.map(v => 
          v > statsSummary?.totalManaged / 5 ? 'rgba(99, 102, 241, 0.8)' : 
          v > statsSummary?.totalManaged / 10 ? 'rgba(99, 102, 241, 0.5)' : 
          'rgba(99, 102, 241, 0.2)'
        ),
        borderRadius: 8,
      }]
    };
  }, [allMetrics, statsSummary]);

  if (!profile || profile.role !== 'admin' || !profile.is_enabled) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <AlertCircle size={48} color="var(--accent-error)" style={{marginBottom: 20}} />
          <h1>Acceso Denegado</h1>
          <p>Solo los administradores habilitados pueden acceder a este panel.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Volver</button>
        </div>
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
          <div className="subtitle">Métricas Inteligentes</div>
        </header>

        <section className="user-info">
          <span>{user?.email}</span>
          <div style={{fontSize: '10px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>ADMINISTRADOR</div>
        </section>

        <nav className="action-section" style={{gap: '12px'}}>
          <button className="btn btn-secondary" style={{width:'100%'}} onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Panel Usuario</button>
          
          <div style={{marginTop: '20px'}}>
             <h3 className="metric-label" style={{fontSize:'11px', marginBottom:'15px'}}><CheckCircle2 size={12} style={{marginRight:5}} /> Ranking Top 5 (Efficiency)</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {leaderboard.map((u, i) => (
                  <div key={u.id} style={{
                    display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderRadius:'12px', 
                    background: i === 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid', borderColor: i === 0 ? 'var(--accent-warning)' : 'var(--border-light)'
                  }}>
                    <div style={{width:24, height:24, borderRadius:'50%', background: i === 0 ? 'var(--accent-warning)' : 'var(--border-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:'bold'}}>
                       {i === 0 ? <Trophy size={12} color="white" /> : i+1}
                    </div>
                    <div style={{flexGrow:1, overflow:'hidden'}}>
                       <div style={{fontSize:12, fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis'}}>{u.email.split('@')[0]}</div>
                       <div style={{fontSize:10, color:'var(--text-dim)'}}>{u.efficiency.toFixed(1)}% Eff.</div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="admin-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'30px'}}>
             <div>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <h2 style={{fontSize: '32px', marginBottom: '4px'}}>Rendimiento de Equipo</h2>
                  <div className="live-badge">
                    <div className="pulse-dot"></div>
                    EN VIVO
                  </div>
                </div>
                <p style={{color: 'var(--text-muted)'}}>Analizando tendencias y productividad de {users.length} operadores</p>
             </div>
             
             <div className="filter-group" style={{maxWidth:'500px', width:'100%', display:'flex', gap:'12px', alignItems:'center'}}>
                <div style={{position:'relative', flexGrow: 1}}>
                  <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)'}} />
                  <input type="text" placeholder="Buscar por correo..." className="filter-input" style={{width:'100%', paddingLeft:'40px', height:'45px', borderRadius:'12px'}} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button className="btn btn-secondary" onClick={() => fetchData(true)} disabled={isRefreshing} style={{height: '45px', width: '45px', padding:0, borderRadius: '12px'}}><RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} /></button>
             </div>
        </div>

        {/* ANALYTICS ROW */}
        <div style={{display:'grid', gridTemplateColumns: '2fr 1fr', gap:'24px', marginBottom:'24px'}}>
            <div className="metric-card" style={{padding: '24px'}}>
               <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                  <span className="metric-label"><TrendingUp size={14} style={{marginRight:5}} /> Tendencia Semanal de Gestión</span>
               </div>
               <div style={{height: '300px'}}>
                  <Line data={trendChartData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } }, plugins: { legend: { labels: { color: '#94a3b8' } } } }} />
               </div>
            </div>
            <div className="metric-card" style={{padding: '24px'}}>
               <span className="metric-label"><Flame size={14} style={{marginRight:5}} /> Peak de Gestión por Día</span>
               <div style={{height: '300px'}}>
                  <Bar data={heatmapData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } }, plugins: { legend: { display: false } } }} />
               </div>
            </div>
        </div>

        {/* DATA TABLE */}
        <div className="history-section">
          <div className="metric-card" style={{padding: '0'}}>
            <div className="table-header" style={{padding: '24px 32px', borderBottom:'1px solid var(--border-light)'}}>
               <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <Calendar size={20} className="text-primary" />
                  <span className="metric-label" style={{margin:0}}>Métricas Globales (Historial)</span>
               </div>
               <select className="filter-input" value={selectedUserEmail} onChange={e => setSelectedUserEmail(e.target.value)}>
                  <option value="all">Todos los Operadores</option>
                  {users.map(u => <option key={u.id} value={u.email}>{u.email}</option>)}
               </select>
            </div>
            <div className="table-container" style={{maxHeight:'500px'}}>
                <table className="history-table admin-table">
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', paddingLeft:'32px'}}>Operador</th>
                      <th>Fecha</th>
                      <th>A Tiempo</th>
                      <th>Gest.</th>
                      <th>Cerr.</th>
                      <th>% Cierre</th>
                      <th>G/h</th>
                      <th>% Reso.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map((item) => {
                      const email = users.find(u => u.id === item.user_id)?.email || 'Unknown';
                      return (
                        <tr key={item.id}>
                          <td style={{textAlign:'left', paddingLeft:'32px'}}>
                            <div style={{display:'flex', flexDirection:'column'}}>
                               <span style={{fontWeight:'700', color:'var(--text-bright)'}}>{email.split('@')[0]}</span>
                               <span style={{fontSize:'10px', color:'var(--text-dim)'}}>{email}</span>
                            </div>
                          </td>
                          <td style={{fontWeight:'600'}}>{item.date}</td>
                          <td>{item.total_time}</td>
                          <td>{item.cases_managed}</td>
                          <td>{item.cases_closed}</td>
                          <td className={getStatusClass(item.efficiency, STANDARDS.CLOSED_GREEN, 76.8)}>{item.efficiency}%</td>
                          <td className={getStatusClass(item.cases_per_hour, STANDARDS.GXH_GREEN, STANDARDS.GXH_YELLOW)}>{item.cases_per_hour}</td>
                          <td className={getStatusClass(item.resolution_rate, STANDARDS.RESOLUTION_GREEN, 76.8)}>{item.resolution_rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      </main>
      
      <style>{`
        .live-badge {
          background: rgba(239, 68, 68, 0.1); color: var(--accent-error);
          padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800;
          border: 1px solid rgba(239, 68, 68, 0.2); display: flex; alignItems: center; gap: 5px;
        }
        .pulse-dot { width: 6px; height: 6px; background: var(--accent-error); border-radius: 50%; animation: pulse 1.5s infinite; }
      `}</style>
    </div>
  );
}

export default AdminDashboard;
