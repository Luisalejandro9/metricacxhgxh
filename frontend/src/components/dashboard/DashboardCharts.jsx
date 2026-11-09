import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS modules in this file
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function DashboardCharts({
  filteredHistory,
  chartData,
  chartOptions,
  chartDataReso,
  chartOptionsReso,
  chartDataGxhCerrados,
  chartOptionsGxhCerrados
}) {
  return (
    <>
      <div style={{ marginTop: '20px', padding: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-bright)', fontSize: '15px', fontWeight: '700' }}>Tendencia del Mes (GxH vs TMO)</h3>
        <div style={{ height: '300px', width: '100%' }}>
          {filteredHistory.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>No hay datos suficientes para graficar</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-bright)', fontSize: '15px', fontWeight: '700' }}>Tendencia Resolución vs Técnicos</h3>
        <div style={{ height: '300px', width: '100%' }}>
          {filteredHistory.length > 0 ? (
            <Line data={chartDataReso} options={chartOptionsReso} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>No hay datos suficientes para graficar</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-bright)', fontSize: '15px', fontWeight: '700' }}>Tendencia GxH vs Casos Cerrados</h3>
        <div style={{ height: '300px', width: '100%' }}>
          {filteredHistory.length > 0 ? (
            <Line data={chartDataGxhCerrados} options={chartOptionsGxhCerrados} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>No hay datos suficientes para graficar</div>
          )}
        </div>
      </div>
    </>
  );
}

export default DashboardCharts;
