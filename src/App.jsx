import React, { useState, useMemo, useEffect } from 'react';
import { X, Maximize, Minimize, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import rawData from './data/consolidado.json';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

function App() {
  const [periodo, setPeriodo] = useState('TODOS');
  const [centro, setCentro] = useState('TODOS');
  const [metric, setMetric] = useState('DESERCION/NO ATENDIDAS');
  const [modalType, setModalType] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 100;
  const [detalles, setDetalles] = useState([]);
  const [detallesLoaded, setDetallesLoaded] = useState(false);
  const [filtroServicio, setFiltroServicio] = useState('TODOS');
  const [actividad, setActividad] = useState('TODOS');

  // Load large patient detail file lazily via fetch (avoids Vite OOM)
  useEffect(() => {
    fetch('/detalles.json')
      .then(r => r.json())
      .then(data => { setDetalles(data); setDetallesLoaded(true); })
      .catch(err => console.error('Error loading detalles:', err));
  }, []);

  // Toggle internal fullscreen state when user presses Esc or closes fullscreen via browser
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Find all available periods
  const periodos = useMemo(() => {
    const pSet = new Set();
    rawData.forEach(item => {
      if(item.PERIODO) pSet.add(item.PERIODO);
    });
    return Array.from(pSet).sort();
  }, []);

  // Find all available centros
  const centros = useMemo(() => {
    const cSet = new Set();
    rawData.forEach(item => {
      if(item.CENTRO) cSet.add(item.CENTRO);
    });
    return Array.from(cSet).sort();
  }, []);

  // Find all available actividades for current periodo+centro
  const actividades = useMemo(() => {
    const aSet = new Set();
    rawData.forEach(item => {
      const matchPeriodo = periodo === 'TODOS' || item.PERIODO === periodo;
      const matchCentro  = centro  === 'TODOS' || item.CENTRO  === centro;
      if (matchPeriodo && matchCentro && item.ACTIVIDAD) aSet.add(item.ACTIVIDAD);
    });
    return Array.from(aSet).sort();
  }, [periodo, centro]);

  // Filter data based on selected period, centro and actividad
  const dataFiltered = useMemo(() => {
    return rawData.filter(d => {
      const matchPeriodo   = periodo   === 'TODOS' || d.PERIODO   === periodo;
      const matchCentro    = centro    === 'TODOS' || d.CENTRO    === centro;
      const matchActividad = actividad === 'TODOS' || d.ACTIVIDAD === actividad;
      return matchPeriodo && matchCentro && matchActividad;
    });
  }, [periodo, centro, actividad]);

  // General KPIs computing
  const kpis = useMemo(() => {
    let totalCitas = 0;
    let atendidas = 0;
    let desercion = 0;
    let pendientes = 0;

    dataFiltered.forEach(d => {
      totalCitas += d.TOTAL;
      const estado = d.ESTADO_CITA?.toUpperCase() || "";
      if (estado.includes('ATENDIDA')) atendidas += d.TOTAL;
      else if (estado.includes('DESERCION')) desercion += d.TOTAL;
      else if (estado.includes('PENDIENTE')) pendientes += d.TOTAL;
    });

    const noAtendidas = desercion + pendientes; // general view of non attended

    return { totalCitas, atendidas, desercion, pendientes, noAtendidas };
  }, [dataFiltered]);

  // Detail data for modal from detalles (fetched lazily)
  const detailData = useMemo(() => {
    if (!modalType) return [];
    
    return detalles.filter(d => {
      const matchPeriodo = periodo === 'TODOS' || d.PERIODO === periodo;
      const matchCentro = centro === 'TODOS' || d.CENTRO === centro;
      const estado = d.ESTADO_CITA?.toUpperCase() || "";
      const matchEstado = modalType === 'DESERCION' ? estado.includes('DESERCION') : estado.includes('PENDIENTE');
      return matchPeriodo && matchCentro && matchEstado;
    }).sort((a, b) => (a.FECHA_CITA || '').localeCompare(b.FECHA_CITA || ''));
  }, [modalType, periodo, centro, detalles]);

  // Unique services available in the current detailData
  const serviciosDisponibles = useMemo(() => {
    const s = new Set();
    detailData.forEach(d => { if (d.SERVICIO) s.add(d.SERVICIO); });
    return Array.from(s).sort();
  }, [detailData]);

  // detailData filtered by servicio
  const filteredDetailData = useMemo(() => {
    if (filtroServicio === 'TODOS') return detailData;
    return detailData.filter(d => d.SERVICIO === filtroServicio);
  }, [detailData, filtroServicio]);

  // Export to Excel
  const exportToExcel = () => {
    const rows = filteredDetailData.map(d => ({
      DNI: d.DOC_PACIENTE,
      Paciente: d.PACIENTE,
      Fecha: d.FECHA_CITA,
      Hora: d.HORA_CITA,
      Celular: d.TEL_MOVIL || '',
      Centro: d.CENTRO,
      Servicio: d.SERVICIO,
      Subactividad: d.SUBACTIVIDAD || 'SIN ESPECIFICAR',
      Profesional: d.PROFESIONAL || '',
      Periodo: d.PERIODO,
      Estado: d.ESTADO_CITA,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deserción');
    const label = filtroServicio !== 'TODOS' ? `_${filtroServicio.substring(0, 20)}` : '';
    XLSX.writeFile(wb, `desercion${label}.xlsx`);
  };

  // Handle modal opening and state resets
  const openModal = (type) => {
    setModalType(type);
    setSelectedRecord(null);
    setPage(1);
    setFiltroServicio('TODOS');
  };

  // Aggregate for Primary Bar Chart (Centro or Servicio depending on filter)
  const chartDataPrimaryBar = useMemo(() => {
    const agg = {};
    const field = centro === 'TODOS' ? 'CENTRO' : 'SERVICIO';

    dataFiltered.forEach(d => {
      const estado = d.ESTADO_CITA?.toUpperCase() || "";
      const isUnattended = estado.includes('DESERCION');
      if (isUnattended) {
        agg[d[field]] = (agg[d[field]] || 0) + d.TOTAL;
      }
    });

    // Top 10 with most unattended
    const sorted = Object.entries(agg).sort((a,b) => b[1] - a[1]).slice(0, 10);

    return {
      labels: sorted.map(i => i[0].substring(0, 25)),
      datasets: [
        {
          label: 'Citas No Atendidas / Deserción',
          data: sorted.map(i => i[1]),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderRadius: 4
        }
      ]
    };
  }, [dataFiltered, centro]);

  // Aggregate by Servicio/Subactividad for second chart
  const chartDataSecundary = useMemo(() => {
    const agg = {};
    const field = centro === 'TODOS' ? 'SERVICIO' : 'SUBACTIVIDAD';

    dataFiltered.forEach(d => {
      const estado = d.ESTADO_CITA?.toUpperCase() || "";
      const isUnattended = estado.includes('DESERCION');
      if (isUnattended) {
        const key = d[field] || (field === 'SUBACTIVIDAD' ? 'SIN ESPECIFICAR' : 'DESCONOCIDO');
        agg[key] = (agg[key] || 0) + d.TOTAL;
      }
    });

    // Top 10
    const sorted = Object.entries(agg).sort((a,b) => b[1] - a[1]).slice(0, 10);

    if (centro === 'TODOS') {
      const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1'
      ];
      return {
        labels: sorted.map(i => i[0].substring(0, 25)),
        datasets: [{
          label: 'Servicios con más inasistencias',
          data: sorted.map(i => i[1]),
          backgroundColor: colors,
          borderWidth: 0
        }]
      };
    } else {
      return {
        labels: sorted.map(i => i[0].substring(0, 25)),
        datasets: [{
          label: 'Subactividades con más inasistencias',
          data: sorted.map(i => i[1]),
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          borderRadius: 4
        }]
      };
    }
  }, [dataFiltered, centro]);

  // Aggregate by Profesional for third chart
  const chartDataProfesional = useMemo(() => {
    const agg = {};
    const centrosPorProfesional = {};
    const serviciosPorProfesional = {};
    dataFiltered.forEach(d => {
      const estado = d.ESTADO_CITA?.toUpperCase() || "";
      const isUnattended = estado.includes('DESERCION');
      if (isUnattended) {
        const key = d.PROFESIONAL || 'SIN PROFESIONAL';
        if (key !== 'SIN PROFESIONAL') {
          agg[key] = (agg[key] || 0) + d.TOTAL;
          // Track centros per professional
          if (!centrosPorProfesional[key]) centrosPorProfesional[key] = {};
          centrosPorProfesional[key][d.CENTRO] = (centrosPorProfesional[key][d.CENTRO] || 0) + d.TOTAL;
          // Track servicios per professional
          if (!serviciosPorProfesional[key]) serviciosPorProfesional[key] = {};
          const srv = d.SERVICIO || 'SIN SERVICIO';
          serviciosPorProfesional[key][srv] = (serviciosPorProfesional[key][srv] || 0) + d.TOTAL;
        }
      }
    });

    // Top 15 Professionals
    const sorted = Object.entries(agg).sort((a,b) => b[1] - a[1]).slice(0, 15);

    // Primary centro per professional (the one with most records)
    const centros = sorted.map(([prof]) => {
      const centroMap = centrosPorProfesional[prof] || {};
      return Object.entries(centroMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Desconocido';
    });

    // Primary servicio per professional (the one with most records)
    const servicios = sorted.map(([prof]) => {
      const srvMap = serviciosPorProfesional[prof] || {};
      return Object.entries(srvMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Desconocido';
    });

    return {
      labels: sorted.map(i => i[0]),
      centros,
      servicios,
      datasets: [
        {
          label: 'Citas No Atendidas por Profesional',
          data: sorted.map(i => i[1]),
          backgroundColor: 'rgba(24, 113, 185, 0.8)',
          borderRadius: 4
        }
      ]
    };
  }, [dataFiltered]);

  // Aggregate by Dia from detalles (loaded lazily) for the fourth chart
  const chartDataDias = useMemo(() => {
    const agg = {};
    detalles.forEach(d => {
      const estado = d.ESTADO_CITA?.toUpperCase() || '';
      if (!estado.includes('DESERCION')) return;
      const matchPeriodo = periodo === 'TODOS' || d.PERIODO === periodo;
      const matchCentro  = centro  === 'TODOS' || d.CENTRO  === centro;
      if (!matchPeriodo || !matchCentro) return;
      const dia = d.FECHA_CITA ? d.FECHA_CITA.split('/')[0] : null;
      if (!dia || isNaN(parseInt(dia))) return;
      agg[dia] = (agg[dia] || 0) + 1;
    });
    const sorted = Object.entries(agg).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    return {
      labels: sorted.map(i => `Día ${i[0]}`),
      datasets: [{
        label: 'Inasistencias',
        data: sorted.map(i => i[1]),
        borderColor: 'rgba(239, 68, 68, 0.9)',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        fill: true
      }]
    };
  }, [detalles, periodo, centro]);

  // Aggregate by Mes from detalles (used when no period is selected)
  const chartDataMeses = useMemo(() => {
    const agg = {};
    detalles.forEach(d => {
      const estado = d.ESTADO_CITA?.toUpperCase() || '';
      if (!estado.includes('DESERCION')) return;
      const matchCentro = centro === 'TODOS' || d.CENTRO === centro;
      if (!matchCentro) return;
      const mes = d.PERIODO || 'SIN MES';
      agg[mes] = (agg[mes] || 0) + 1;
    });
    const sorted = Object.entries(agg).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: sorted.map(i => i[0]),
      datasets: [{
        label: 'Inasistencias',
        data: sorted.map(i => i[1]),
        borderColor: 'rgba(239, 68, 68, 0.9)',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 2,
        pointRadius: 5,
        tension: 0.3,
        fill: true
      }]
    };
  }, [detalles, centro]);

  return (
    <div className="dashboard-container">
      <header className="glass-header">
        <div className="header-content">
          <div className="logo">
            <img
              src="/LogoEsSalud.gif"
              alt="Logo EsSalud"
              style={{ height: '80px', width: 'auto', opacity: 0.95, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))', objectFit: 'contain' }}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
            <h1>EsSalud - Monitoreo de Citas</h1>
          </div>
          <div className="header-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label>Centro:</label>
              <select className="premium-select" value={centro} onChange={(e) => { setCentro(e.target.value); setActividad('TODOS'); }}>
                <option value="TODOS">Todos los Centros</option>
                {centros.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label>Periodo:</label>
              <select className="premium-select" value={periodo} onChange={(e) => { setPeriodo(e.target.value); setActividad('TODOS'); }}>
                <option value="TODOS">Todos los Periodos</option>
                {periodos.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label>Actividad:</label>
              <select className="premium-select" value={actividad} onChange={(e) => setActividad(e.target.value)}>
                <option value="TODOS">Todas las Actividades</option>
                {actividades.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <button className="icon-btn" onClick={toggleFullscreen} title="Pantalla Completa">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="kpi-grid">
          <div className="kpi-card outline-primary">
            <h3>Total Citas General</h3>
            <div className="kpi-value">{kpis.totalCitas.toLocaleString()}</div>
          </div>
          <div className="kpi-card outline-success">
            <h3>Atendidas</h3>
            <div className="kpi-value">{kpis.atendidas.toLocaleString()}</div>
            <div className="kpi-subtext">{((kpis.atendidas/kpis.totalCitas)*100 || 0).toFixed(1)}% del total</div>
          </div>
          <div className="kpi-card outline-danger clickable" onClick={() => openModal('DESERCION')}>
            <h3>Deserción</h3>
            <div className="kpi-value">{kpis.desercion.toLocaleString()}</div>
            <div className="kpi-subtext">{((kpis.desercion/kpis.totalCitas)*100 || 0).toFixed(1)}% del total</div>
            <div style={{fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--danger-color)'}}>Ver detalle &rarr;</div>
          </div>
          <div className="kpi-card outline-warning clickable" onClick={() => openModal('PENDIENTE')}>
            <h3>Pendientes</h3>
            <div className="kpi-value">{kpis.pendientes.toLocaleString()}</div>
            <div style={{fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--warning-color)'}}>Ver detalle &rarr;</div>
          </div>
        </section>

        <section className="charts-grid">
          <div className="chart-card glass-panel">
            <h2>{centro === 'TODOS' ? 'Citas No Atendidas por Centro (Top 10)' : 'Citas No Atendidas por Servicio (Top 10)'}</h2>
            <p className="chart-desc">{centro === 'TODOS' ? 'Impacto de ausentismo por establecimiento de salud' : 'Impacto de ausentismo por especialidad en este centro'}</p>
            <div className="chart-wrapper">
              <Bar 
                data={chartDataPrimaryBar} 
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { x: { beginAtZero: true } }
                }} 
              />
            </div>
          </div>

          <div className="chart-card glass-panel flex-center">
            <h2>{centro === 'TODOS' ? 'Citas No Atendidas por Servicio (Top 10)' : 'Citas No Atendidas por Subactividad (Top 10)'}</h2>
            <p className="chart-desc">{centro === 'TODOS' ? 'Distribución de especialidades afectadas' : 'Impacto específico por subactividad'}</p>
            <div className={`chart-wrapper ${centro === 'TODOS' ? 'pie-wrapper' : ''}`}>
              {centro === 'TODOS' ? (
                <Doughnut 
                  data={chartDataSecundary} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                      legend: { position: 'right', labels: { color: 'var(--text-color)', font: { family: 'Inter' } } }
                    }
                  }} 
                />
              ) : (
                <Bar 
                  data={chartDataSecundary} 
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                  }} 
                />
              )}
            </div>
          </div>

          <div className="chart-card glass-panel full-width-chart">
            <h2>Citas No Atendidas por Profesional (Top 15)</h2>
            <p className="chart-desc">Deserciones asociadas a la agenda de profesionales médicos</p>
            <div className="chart-wrapper" style={{height: '400px'}}>
              <Bar 
                data={chartDataProfesional} 
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        afterLabel: (context) => {
                          const centro = chartDataProfesional.centros?.[context.dataIndex];
                          const servicio = chartDataProfesional.servicios?.[context.dataIndex];
                          const lines = [];
                          if (centro) lines.push(`📍 Centro: ${centro}`);
                          if (servicio) lines.push(`🩺 Servicio: ${servicio}`);
                          return lines;
                        }
                      }
                    }
                  },
                  scales: { x: { beginAtZero: true } }
                }} 
              />
            </div>
          </div>

          <div className="chart-card glass-panel full-width-chart">
            <h2>{periodo === 'TODOS' ? 'Evolución de Citas No Atendidas por Mes' : 'Evolución de Citas No Atendidas por Día'}</h2>
            <p className="chart-desc">{periodo === 'TODOS' ? 'Tendencia mensual de inasistencias acumuladas' : 'Tendencia diaria de inasistencias en el período seleccionado'}</p>
            <div className="chart-wrapper" style={{height: '350px'}}>
              {periodo === 'TODOS' ? (
                <Bar
                  data={{
                    ...chartDataMeses,
                    datasets: [{
                      ...chartDataMeses.datasets[0],
                      backgroundColor: chartDataMeses.labels.map((_, i) =>
                        `hsl(${(i * 37) % 360}, 65%, 55%)`
                      ),
                      borderColor: chartDataMeses.labels.map((_, i) =>
                        `hsl(${(i * 37) % 360}, 65%, 40%)`
                      ),
                      borderWidth: 1,
                      borderRadius: 6
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { maxRotation: 90, minRotation: 90 }
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                          precision: 0,
                          callback: (value) => Number.isInteger(value) ? value : null
                        }
                      }
                    }
                  }}
                />
              ) : (
                <Line
                  data={chartDataDias}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { maxRotation: 90, minRotation: 90 }
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                          precision: 0,
                          callback: (value) => Number.isInteger(value) ? value : null
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </section>
      </main>

      {modalType && (
        <div className="modal-overlay" onClick={() => { setModalType(null); setSelectedRecord(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedRecord ? 'Detalle Completo del Paciente' : `Detalle de Registros: ${modalType === 'DESERCION' ? 'Deserción' : 'Pendientes'}`}
              </h2>
              <button className="close-btn" onClick={() => { setModalType(null); setSelectedRecord(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {selectedRecord ? (
                <div className="patient-detail-form">
                  <button className="back-btn" onClick={() => setSelectedRecord(null)}>
                    &larr; Volver a la lista
                  </button>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>DNI</label>
                      <div className="form-value" style={{fontWeight: 600, color: 'var(--primary-color)'}}>{selectedRecord.DOC_PACIENTE}</div>
                    </div>
                    <div className="form-group">
                      <label>Paciente</label>
                      <div className="form-value" style={{fontWeight: 600}}>{selectedRecord.PACIENTE}</div>
                    </div>
                    
                    <div className="form-group">
                      <label>Fecha y Hora</label>
                      <div className="form-value">{selectedRecord.FECHA_CITA} - {selectedRecord.HORA_CITA}</div>
                    </div>
                    <div className="form-group">
                      <label>Celular</label>
                      <div className="form-value">{selectedRecord.TEL_MOVIL || '-'}</div>
                    </div>
                    
                    <div className="form-group full-width">
                      <label>Centro (Establecimiento de Salud)</label>
                      <div className="form-value">{selectedRecord.CENTRO}</div>
                    </div>
                    
                    <div className="form-group">
                      <label>Servicio M\u00e9dico</label>
                      <div className="form-value">{selectedRecord.SERVICIO}</div>
                    </div>
                    <div className="form-group">
                      <label>Subactividad</label>
                      <div className="form-value">{selectedRecord.SUBACTIVIDAD || 'SIN ESPECIFICAR'}</div>
                    </div>

                    <div className="form-group">
                      <label>Estado</label>
                      <div className="form-value" style={{background: 'transparent', padding: '0.2rem', border: 'none'}}>
                        <span className={`status-badge ${selectedRecord.ESTADO_CITA.toLowerCase().includes('desercion') ? 'danger' : 'warning'}`}>
                          {selectedRecord.ESTADO_CITA}
                        </span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Periodo</label>
                      <div className="form-value">{selectedRecord.PERIODO}</div>
                    </div>
                  </div>
                </div>
              ) : (
              <React.Fragment>
                {/* Toolbar: filter + export */}
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1.5rem', borderBottom:'1px solid var(--border-color)', background:'var(--bg-secondary)', flexWrap:'wrap'}}>
                  <label style={{fontSize:'0.85rem', fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap'}}>Filtrar por Servicio:</label>
                  <select
                    value={filtroServicio}
                    onChange={e => { setFiltroServicio(e.target.value); setPage(1); }}
                    style={{flex:1, minWidth:'200px', maxWidth:'400px', padding:'0.4rem 0.75rem', borderRadius:'0.5rem', border:'1px solid var(--border-color)', background:'#f8fafc', color:'var(--text-color)', fontSize:'0.85rem', fontFamily:'Inter,sans-serif'}}
                  >
                    <option value="TODOS">Todos los servicios ({detailData.length} registros)</option>
                    {serviciosDisponibles.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span style={{fontSize:'0.82rem', color:'var(--text-muted)', marginLeft:'auto'}}>
                    {filteredDetailData.length} registro{filteredDetailData.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={exportToExcel}
                    title="Exportar a Excel"
                    style={{display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.4rem 0.85rem', background:'rgba(16,185,129,0.12)', color:'#10b981', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'0.5rem', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', whiteSpace:'nowrap', transition:'all 0.2s'}}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(16,185,129,0.25)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(16,185,129,0.12)'}
                  >
                    <FileDown size={16}/> Exportar Excel
                  </button>
                </div>
                <div className="data-grid-container">
                  <table className="data-grid text-sm">
                    <thead>
                      <tr>
                        <th>DNI</th>
                        <th>Paciente</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Celular</th>
                        <th>Centro</th>
                        <th>Servicio</th>
                        <th>Subactividad</th>
                        <th>Profesional</th>
                        <th>Periodo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDetailData.slice((page - 1) * itemsPerPage, page * itemsPerPage).map((row, idx) => (
                        <tr key={idx} className="clickable-row" onClick={() => setSelectedRecord(row)}>
                          <td style={{fontWeight: 500}}>{row.DOC_PACIENTE}</td>
                          <td style={{maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={row.PACIENTE}>{row.PACIENTE}</td>
                          <td style={{whiteSpace: 'nowrap'}}>{row.FECHA_CITA}</td>
                          <td style={{whiteSpace: 'nowrap'}}>{row.HORA_CITA}</td>
                          <td>{row.TEL_MOVIL}</td>
                          <td style={{maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={row.CENTRO}>{row.CENTRO}</td>
                          <td style={{maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={row.SERVICIO}>{row.SERVICIO}</td>
                          <td style={{maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={row.SUBACTIVIDAD || 'SIN ESPECIFICAR'}>{row.SUBACTIVIDAD || 'SIN ESPECIFICAR'}</td>
                          <td style={{maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={row.PROFESIONAL || '-'}>{row.PROFESIONAL || '-'}</td>
                          <td style={{whiteSpace: 'nowrap'}}>{row.PERIODO}</td>
                        </tr>
                      ))}
                      {filteredDetailData.length === 0 && (
                        <tr>
                          <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No hay registros para mostrar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredDetailData.length > 0 && !selectedRecord && (
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)'}}>
                    <div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                      Mostrando {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredDetailData.length)} de {filteredDetailData.length} registros
                    </div>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button 
                        onClick={() => setPage(Math.max(page - 1, 1))} 
                        disabled={page === 1}
                        style={{padding: '0.4rem 0.8rem', background: page === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.2)', color: page === 1 ? 'var(--text-muted)' : 'var(--primary-color)', border: 'none', borderRadius: '0.25rem', cursor: page === 1 ? 'not-allowed' : 'pointer'}}
                      >
                        Anterior
                      </button>
                      <button 
                        onClick={() => setPage(Math.min(page + 1, Math.ceil(filteredDetailData.length / itemsPerPage)))} 
                        disabled={page >= Math.ceil(filteredDetailData.length / itemsPerPage)}
                        style={{padding: '0.4rem 0.8rem', background: page >= Math.ceil(filteredDetailData.length / itemsPerPage) ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.2)', color: page >= Math.ceil(filteredDetailData.length / itemsPerPage) ? 'var(--text-muted)' : 'var(--primary-color)', border: 'none', borderRadius: '0.25rem', cursor: page >= Math.ceil(filteredDetailData.length / itemsPerPage) ? 'not-allowed' : 'pointer'}}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
