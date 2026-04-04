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
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
      // 1. Fetch Users from profiles
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('email');
      
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // 2. Fetch all metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false });
      
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

  // Load initial data
  useEffect(() => {
    fetchData();
  }, [setNetworkError]);

  // Derived: Filtered users and metrics
  const filteredMetrics = useMemo(() => {
    let filtered = allMetrics;
    
    // Filter by user selection
    if (selectedUserEmail !== 'all') {
      const userObj = users.find(u => u.email === selectedUserEmail);
      if (userObj) {
        filtered = filtered.filter(m => m.user_id === userObj.id);
      }
    }

    // Filter by search term (email matching)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => {
        const userObj = users.find(u => u.id === m.user_id);
        return userObj?.email.toLowerCase().includes(term);
      });
    }

    return filtered;
  }, [allMetrics, selectedUserEmail, users, searchTerm]);

  const getStatusClass = (value, greenTarget, yellowTarget) => {
    const val = parseFloat(value);
    if (val >= greenTarget) return 'stat-meets-standard';
    if (val >= yellowTarget) return 'stat-warning-standard';
    return 'stat-below-standard';
  };

  const getUserEmail = (userId) => {
    return users.find(u => u.id === userId)?.email || 'Usuario Desconocido';
  };

  const statsSummary = useMemo(() => {
    if (allMetrics.length === 0) return null;
    
    const totalManaged = allMetrics.reduce((sum, m) => sum + (m.cases_managed || 0), 0);
    const totalClosed = allMetrics.reduce((sum, m) => sum + (m.cases_closed || 0), 0);
    const totalTechs = allMetrics.reduce((sum, m) => sum + (m.technicians_sent || 0), 0);
    
    return {
      totalManaged,
      totalClosed,
      totalTechs,
      avgEfficiency: ((totalClosed / totalManaged) * 100).toFixed(1),
      userCount: users.length
    };
  }, [allMetrics, users]);

  if (!profile || profile.role !== 'admin' || !profile.is_enabled) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <AlertCircle size={48} color="var(--accent-error)" style={{marginBottom: 20}} />
          <h1>Acceso Denegado</h1>
          <p>Solo los administradores habilitados pueden acceder a este panel.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Volver al Dashboard
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
          <div style={{display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'10px'}}>
             <Database className="text-primary" size={24} />
             <h1 style={{margin:0}}>Admin Panel</h1>
          </div>
          <div className="subtitle">GESTIÓN DE MÉTRICAS GLOBALES</div>
        </header>

        <section className="user-info">
          <span>{user?.email}</span>
          <div style={{
            fontSize: '10px', 
            background: 'var(--primary)', 
            color: 'white', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            display: 'inline-block',
            fontWeight: 'bold'
          }}>
            ADMINISTRADOR
          </div>
        </section>

        <nav className="action-section" style={{gap: '12px'}}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Panel de Usuario
          </button>
          
          <div style={{marginTop: '20px'}}>
             <h3 className="metric-label" style={{fontSize:'11px', marginBottom:'15px'}}>Usuarios en Sistema</h3>
             <div style={{display:'flex', flexDirection:'column', gap:'8px', maxHeight:'300px', overflowY:'auto', paddingRight:'5px'}}>
                {users.map(u => (
                  <div 
                    key={u.id} 
                    className={`user-list-item ${selectedUserEmail === u.email ? 'active' : ''}`}
                    onClick={() => setSelectedUserEmail(u.email)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: selectedUserEmail === u.email ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid',
                      borderColor: selectedUserEmail === u.email ? 'var(--primary-light)' : 'var(--border-light)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Mail size={14} color={u.role === 'admin' ? 'var(--primary-light)' : 'var(--text-dim)'} />
                    <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {u.email}
                    </span>
                  </div>
                ))}
                <div 
                    className={`user-list-item ${selectedUserEmail === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedUserEmail('all')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: selectedUserEmail === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid',
                      borderColor: selectedUserEmail === 'all' ? 'var(--primary-light)' : 'var(--border-light)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Users size={14} />
                    <span>Ver Todos</span>
                  </div>
             </div>
          </div>
        </nav>

        <section className="standards-section">
          <h3>Resumen Global</h3>
          <div className="standard-row"><span>Usuarios</span> <span>{users.length}</span></div>
          <div className="standard-row"><span>Registros</span> <span>{allMetrics.length}</span></div>
          <div className="standard-row"><span>Gestiones</span> <span>{statsSummary?.totalManaged || 0}</span></div>
        </section>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="admin-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'30px'}}>
             <div>
                <h2 style={{fontSize: '32px', marginBottom: '4px'}}>Dashboard Administrador</h2>
                <p style={{color: 'var(--text-muted)'}}>Monitoreo de métricas y rendimiento del equipo</p>
             </div>
             
             <div className="filter-group" style={{maxWidth:'500px', width:'100%', display:'flex', gap:'12px', alignItems:'center'}}>
                <div style={{position:'relative', flexGrow: 1}}>
                  <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)'}} />
                  <input 
                    type="text" 
                    placeholder="Buscar por correo electrónico..." 
                    className="filter-input"
                    style={{width:'100%', paddingLeft:'40px', height:'45px', borderRadius:'12px'}}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  style={{
                    height: '45px', 
                    width: '45px', 
                    padding:0, 
                    borderRadius: '12px',
                    borderColor: isRefreshing ? 'var(--primary-light)' : 'var(--border-light)'
                  }}
                  title="Recargar datos"
                >
                  <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
                </button>
             </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid-secondary" style={{marginBottom: '32px'}}>
          <div className="metric-card">
            <span className="metric-label">Total Gestiones (All)</span>
            <div className="metric-value medium">{statsSummary?.totalManaged || 0}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total Cierres (All)</span>
            <div className="metric-value medium">{statsSummary?.totalClosed || 0}</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Eficiencia Promedio</span>
            <div className="metric-value medium">{statsSummary?.avgEfficiency || 0}%</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Usuarios Activos</span>
            <div className="metric-value medium">{statsSummary?.userCount || 0}</div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="history-section">
          <div className="metric-card" style={{padding: '0', overflow:'visible'}}>
            <div className="table-header" style={{padding: '24px 32px', borderBottom:'1px solid var(--border-light)'}}>
               <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <BarChart3 size={20} className="text-primary" />
                  <span className="metric-label" style={{margin:0}}>Métricas Consolidadas</span>
               </div>
               <div style={{fontSize:'12px', color:'var(--text-dim)', background:'rgba(255,255,255,0.05)', padding:'4px 12px', borderRadius:'20px', border:'1px solid var(--border-light)'}}>
                  Mostrando {filteredMetrics.length} registros
               </div>
            </div>

            <div className="table-container" style={{maxHeight:'600px'}}>
              {loading ? (
                <div className="loading-state">
                   <div className="spinner" style={{marginBottom: '20px'}}></div>
                   Procesando datos del equipo...
                </div>
              ) : filteredMetrics.length === 0 ? (
                <div className="empty-state">No se encontraron registros para los filtros aplicados.</div>
              ) : (
                <table className="history-table admin-table">
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', paddingLeft:'32px'}}>Operador</th>
                      <th>Fecha</th>
                      <th>Duración</th>
                      <th>Gest.</th>
                      <th>Cerr.</th>
                      <th>% Cierre</th>
                      <th>G/h</th>
                      <th>% Reso.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map((item) => {
                      const email = getUserEmail(item.user_id);
                      return (
                        <tr key={item.id}>
                          <td style={{textAlign:'left', paddingLeft:'32px'}}>
                            <div style={{display:'flex', flexDirection:'column'}}>
                               <span style={{fontWeight:'700', color:'var(--text-bright)'}}>{email.split('@')[0]}</span>
                               <span style={{fontSize:'11px', color:'var(--text-dim)'}}>{email}</span>
                            </div>
                          </td>
                          <td style={{fontWeight:'600'}}>{item.date}</td>
                          <td>
                            <div style={{display:'flex', alignItems:'center', gap:'5px', justifyContent:'center'}}>
                               <Clock size={12} color="var(--text-dim)" />
                               {item.total_time}
                            </div>
                          </td>
                          <td>{item.cases_managed}</td>
                          <td>{item.cases_closed}</td>
                          <td className={getStatusClass(item.efficiency, STANDARDS.CLOSED_GREEN, 76.8)}>
                            {item.efficiency}%
                          </td>
                          <td className={getStatusClass(item.cases_per_hour, STANDARDS.GXH_GREEN, STANDARDS.GXH_YELLOW)}>
                            {item.cases_per_hour}
                          </td>
                          <td className={getStatusClass(item.resolution_rate, STANDARDS.RESOLUTION_GREEN, 76.8)}>
                            {item.resolution_rate}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
