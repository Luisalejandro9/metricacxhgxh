import React, { useMemo, useState } from 'react';

const cell = { padding: '10px 12px', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' };
const head = { ...cell, textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', overflowX: 'auto', marginBottom: '18px' };
const fmt = (n, d = 2) => Number.isFinite(Number(n)) ? Number(n).toFixed(d) : '—';
const dayOf = (r) => String(r.fecha_hora_carga || '').split(/[T ]/)[0] || '—';
const net = (r) => Math.max(0, (Number(r.gestionados) || 0) - (Number(r.transferidos) || 0));
const val = (r, k) => Number(r[k]) || 0;

function DataTable({ title, columns, rows, rowKey }) {
  return <section style={card}>
    <div style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-bright)', borderBottom: '1px solid var(--border-light)' }}>{title} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({rows.length})</span></div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
      <thead><tr>{columns.map(c => <th key={c.label} style={head}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((r, i) => <tr key={rowKey(r, i)} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
        {columns.map(c => <td key={c.label} style={cell}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
      </tr>) : <tr><td colSpan={columns.length} style={{ ...cell, textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No hay registros para este agente.</td></tr>}</tbody>
    </table>
  </section>;
}

export default function PulsoHistoryTables({ allRecords = [] }) {
  const agents = useMemo(() => [...new Set(allRecords.map(r => r.agente).filter(a => a && a !== 'TOTAL EQUIPO'))].sort((a,b) => a.localeCompare(b)), [allRecords]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const history = useMemo(() => {
    const snapshots = new Map();
    allRecords.forEach(r => {
      const key = String(r.snapshot_id || String(r.fecha_hora_carga || '') + '|' + String(r.intervalo || ''));
      if (!snapshots.has(key)) snapshots.set(key, { key, fecha: r.fecha_hora_carga, intervalo: r.intervalo, records: [] });
      snapshots.get(key).records.push(r);
    });
    const ordered = [...snapshots.values()].sort((a,b) => String(a.fecha || '').concat(' ',a.intervalo || '').localeCompare(String(b.fecha || '').concat(' ',b.intervalo || '')));
    const selectedByDay = new Map();
    const teamByDay = new Map();
    ordered.forEach(s => {
      const day = dayOf({ fecha_hora_carga: s.fecha });
      const eligible = s.records.filter(r => r.agente && r.agente !== 'TOTAL EQUIPO');
      // Preserve the latest available snapshot for each agent/day, as in Tracker daily history.
      eligible.forEach(r => selectedByDay.set(day + '|' + r.agente, { ...r, day, intervalo: s.intervalo }));
      const totals = eligible.reduce((a,r) => ({ managed:a.managed+net(r), closed:a.closed+val(r,'cerrados'), discarded:a.discarded+val(r,'descartados'), working:a.working+val(r,'working_s') }), {managed:0,closed:0,discarded:0,working:0});
      teamByDay.set(day, { day, ...totals });
    });
    const selected = [...selectedByDay.values()].filter(r => r.agente === selectedAgent).sort((a,b)=>a.day.localeCompare(b.day));
    let accum = { managed:0, closed:0, discarded:0, working:0 };
    const accumRows = selected.map(r => {
      accum = { managed:accum.managed+net(r), closed:accum.closed+val(r,'cerrados'), discarded:accum.discarded+val(r,'descartados'), working:accum.working+val(r,'working_s') };
      return { ...r, ...accum,
        closeRate: accum.managed ? accum.closed/accum.managed*100 : null,
        resoRate: accum.managed ? (accum.managed-accum.discarded)/accum.managed*100 : null,
        gxh: accum.working ? accum.managed/(accum.working/3600) : null
      };
    }).reverse();
    const teamRows = [...teamByDay.values()].sort((a,b)=>a.day.localeCompare(b.day)).map((r,i,rows) => {
      const total = rows.slice(0,i+1).reduce((a,x)=>({managed:a.managed+x.managed,closed:a.closed+x.closed,discarded:a.discarded+x.discarded,working:a.working+x.working}),{managed:0,closed:0,discarded:0,working:0});
      return {...r,...total,closeRate:total.managed?total.closed/total.managed*100:null,resoRate:total.managed?(total.managed-total.discarded)/total.managed*100:null,gxh:total.working?total.managed/(total.working/3600):null};
    }).reverse();
    return { selected: selected.reverse(), accumRows, teamRows };
  }, [allRecords, selectedAgent]);

  const dailyCols = [
    {label:'Fecha',key:'day'},{label:'Intervalo',key:'intervalo'},
    {label:'Gest.',render:r=>net(r)},{label:'Cerr.',render:r=>val(r,'cerrados')},
    {label:'Dif. cierre',render:r=>net(r)-val(r,'cerrados')},
    {label:'Cierre',render:r=>net(r)?fmt(val(r,'cerrados')/net(r)*100,1)+'%':'—'},
    {label:'G/h',render:r=>val(r,'working_s')?fmt(net(r)/(val(r,'working_s')/3600)):'—'},
    {label:'TMO Gest.',render:r=>fmt(val(r,'tmo_s')/60)+' min'}
  ];
  const accumCols = [
    {label:'Fecha',key:'day'},{label:'Acum. casos',key:'managed'},
    {label:'Acum. cierre',render:r=>r.closeRate===null?'—':fmt(r.closeRate,1)+'%'},
    {label:'Acum. reso',render:r=>r.resoRate===null?'—':fmt(r.resoRate,1)+'%'},
    {label:'Acum. GxH',render:r=>r.gxh===null?'—':fmt(r.gxh)},
    {label:'Dif. cierre acum.',render:r=>r.managed-r.closed},
    {label:'Dif. G/h acum.',render:r=>r.gxh===null?'—':fmt(r.gxh)},
    {label:'TMO promedio',render:r=>fmt(r.working&&r.managed? r.working/r.managed/60:0)+' min'}
  ];
  const teamCols = [
    {label:'Fecha',key:'day'},{label:'Gestionados netos acum.',key:'managed'},
    {label:'Cerrados acum.',key:'closed'},{label:'Cierre acum.',render:r=>r.closeRate===null?'—':fmt(r.closeRate,1)+'%'},
    {label:'Resolución neta acum.',render:r=>r.resoRate===null?'—':fmt(r.resoRate,1)+'%'},
    {label:'GxH acum.',render:r=>r.gxh===null?'—':fmt(r.gxh)}
  ];

  return <div>
    <div style={{...card, padding:'16px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:12}}>
      <label htmlFor="pulso-agent" style={{fontWeight:800,color:'var(--text-bright)'}}>Seleccionar agente:</label>
      <select id="pulso-agent" value={selectedAgent} onChange={e=>setSelectedAgent(e.target.value)} style={{minWidth:260,padding:'9px 12px',background:'var(--bg-input)',color:'var(--text-main)',border:'1px solid var(--border-light)',borderRadius:5}}>
        <option value="">Elegí un agente</option>{agents.map(a=><option key={a} value={a}>{a}</option>)}
      </select>
    </div>
    {selectedAgent ? <>
      <DataTable title={'Historial de registros — '+selectedAgent} columns={dailyCols} rows={history.selected} rowKey={(r,i)=>r.day+i}/>
      <DataTable title={'Historial de acumulados — '+selectedAgent} columns={accumCols} rows={history.accumRows} rowKey={(r,i)=>r.day+i}/>
    </> : <div style={{padding:'16px',color:'var(--text-muted)'}}>Seleccioná un agente para consultar sus registros diarios y acumulados.</div>}
    <DataTable title="Acumulado general del equipo Pulso" columns={teamCols} rows={history.teamRows} rowKey={r=>r.day}/>
  </div>;
}
