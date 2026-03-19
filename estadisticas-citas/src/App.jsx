import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Maximize, Minimize, FileDown, RefreshCw } from 'lucide-react';
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

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING — monthly JSON files
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga el índice de meses disponibles desde /data/months-index.json
 * Si no existe (modo legacy), intenta usar el consolidado.json antiguo.
 */
async function loadIndex() {
  const resp = await fetch('/data/months-index.json');
  if (!resp.ok) throw new Error('months-index.json no encontrado');
  return resp.json();  // Array<{ month, consolidado, detalles, totalRows, totalDetalles, updatedAt }>
}

/**
 * Carga los datos consolidados de los meses seleccionados.
 * Retorna { consolidado: [], detalles: [] }
 */
async function loadMonthsData(monthEntries) {
  const consolidadoChunks = await Promise.all(
    monthEntries.map(e => fetch('/' + e.consolidado).then(r => r.json()).catch(() => []))
  );
  return consolidadoChunks.flat();
}

async function loadMonthsDetalles(monthEntries) {
  const detallesChunks = await Promise.all(
    monthEntries.map(e => fetch('/' + e.detalles).then(r => r.json()).catch(() => []))
  );
  return detallesChunks.flat();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [monthsIndex, setMonthsIndex] = useState([]);
  const [selectedYear, setSelectedYear] = useState(''); // Nuevo estado principal
  const [rawData, setRawData] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [indexError, setIndexError] = useState(null);

  const [periodo, setPeriodo] = useState('TODOS');
  const [centro, setCentro] = useState('TODOS');
  const [actividad, setActividad] = useState('TODOS');
  const [modalType, setModalType] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 100;
  const [filtroServicio, setFiltroServicio] = useState('TODOS');
  const [filtroFecha, setFiltroFecha] = useState(''); // Nuevo para el calendario en el modal
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Load index on mount ────────────────────────────────────────────────────
  useEffect(() => {
    loadIndex()
      .then(idx => {
        setMonthsIndex(idx);
        
        // Determinar año actual (2026) o el más reciente
        const currentYear = new Date().getFullYear().toString();
        const years = Array.from(new Set(idx.map(m => m.month.split('-')[0]))).sort();
        
        if (years.includes(currentYear)) {
          setSelectedYear(currentYear);
        } else if (years.length > 0) {
          setSelectedYear(years[years.length - 1]);
        }
      })
      .catch(err => {
        console.error(err);
        setIndexError('No se encontró months-index.json.');
        setLoadingData(false);
      });
  }, []);

  // ── Load data when selectedYear changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedYear || monthsIndex.length === 0) return;

    const entries = monthsIndex.filter(e => e.month.startsWith(selectedYear));
    
    setLoadingData(true);
    setLoadingDetalles(true);
    setPeriodo('TODOS'); // Reiniciar mes al cambiar de año

    loadMonthsData(entries)
      .then(data => { setRawData(data); setLoadingData(false); })
      .catch(err => { console.error(err); setLoadingData(false); });

    loadMonthsDetalles(entries)
      .then(data => { setDetalles(data); setLoadingDetalles(false); })
      .catch(err => { console.error(err); setLoadingDetalles(false); });
  }, [selectedYear, monthsIndex]);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set();
    monthsIndex.forEach(m => years.add(m.month.split('-')[0]));
    return Array.from(years).sort();
  }, [monthsIndex]);

  // Nombre legible del mes (e.g. "2025-01" → "Ene 2025")
  const monthLabel = (key) => {
    const [y, m] = key.split('-');
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${names[parseInt(m) - 1]} ${y}`;
  };

  // ── Derived filters ────────────────────────────────────────────────────────
  const periodos = useMemo(() => {
    const s = new Set();
    rawData.forEach(d => { if (d.PERIODO) s.add(d.PERIODO); });
    return Array.from(s).sort();
  }, [rawData]);

  const centros = useMemo(() => {
    const s = new Set();
    rawData.forEach(d => { if (d.CENTRO) s.add(d.CENTRO); });
    return Array.from(s).sort();
  }, [rawData]);

  const actividades = useMemo(() => {
    const s = new Set();
    rawData.forEach(d => {
      const mp = periodo === 'TODOS' || d.PERIODO === periodo;
      const mc = centro  === 'TODOS' || d.CENTRO  === centro;
      if (mp && mc && d.ACTIVIDAD) s.add(d.ACTIVIDAD);
    });
    return Array.from(s).sort();
  }, [rawData, periodo, centro]);

  const dataFiltered = useMemo(() => rawData.filter(d => {
    const mp = periodo   === 'TODOS' || d.PERIODO   === periodo;
    const mc = centro    === 'TODOS' || d.CENTRO    === centro;
    const ma = actividad === 'TODOS' || d.ACTIVIDAD === actividad;
    
    // Filtro por fecha exacta en el dashboard principal
    let matchFecha = true;
    if (periodo !== 'TODOS' && filtroFecha) {
      const [y, m, d_f] = filtroFecha.split('-');
      const fechaFormateada = `${d_f}/${m}/${y}`;
      matchFecha = d.FECHA_CITA === fechaFormateada;
    }

    return mp && mc && ma && matchFecha;
  }), [rawData, periodo, centro, actividad, filtroFecha]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalCitas = 0, atendidas = 0, desercion = 0, pendientes = 0;
    dataFiltered.forEach(d => {
      totalCitas += d.TOTAL;
      const e = d.ESTADO_CITA?.toUpperCase() || '';
      if (e.includes('ATENDIDA'))  atendidas  += d.TOTAL;
      else if (e.includes('DESERCION')) desercion += d.TOTAL;
      else if (e.includes('PENDIENTE')) pendientes += d.TOTAL;
    });
    return { totalCitas, atendidas, desercion, pendientes, noAtendidas: desercion + pendientes };
  }, [dataFiltered]);

  // ── Modal detail data ──────────────────────────────────────────────────────
  const detailData = useMemo(() => {
    if (!modalType) return [];
    return detalles.filter(d => {
      const mp = periodo === 'TODOS' || d.PERIODO === periodo;
      const mc = centro  === 'TODOS' || d.CENTRO  === centro;
      const ma = actividad === 'TODOS' || d.ACTIVIDAD === actividad; // Añadido filtro actividad
      const e  = d.ESTADO_CITA?.toUpperCase() || '';
      const me = modalType === 'DESERCION' ? e.includes('DESERCION') : e.includes('PENDIENTE');
      
      // Filtro por fecha exacta si el usuario la selecciona en el calendario
      let matchFecha = true;
      if (filtroFecha) {
        const [y, m, d_f] = filtroFecha.split('-');
        const fechaFormateada = `${d_f}/${m}/${y}`;
        matchFecha = d.FECHA_CITA === fechaFormateada;
      }

      return mp && mc && ma && me && matchFecha;
    }).sort((a, b) => (a.FECHA_CITA || '').localeCompare(b.FECHA_CITA || ''));
  }, [modalType, periodo, centro, actividad, detalles, filtroFecha]);

  const serviciosDisponibles = useMemo(() => {
    const s = new Set();
    detailData.forEach(d => { if (d.SERVICIO) s.add(d.SERVICIO); });
    return Array.from(s).sort();
  }, [detailData]);

  const filteredDetailData = useMemo(() => (
    filtroServicio === 'TODOS' ? detailData : detailData.filter(d => d.SERVICIO === filtroServicio)
  ), [detailData, filtroServicio]);

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const rows = filteredDetailData.map(d => ({
      DNI: d.DOC_PACIENTE, Paciente: d.PACIENTE, 
      Edad: d.EDAD, Sexo: d.SEXO, CIE10: d.ULTCIE10ATEN,
      Fecha: d.FECHA_CITA, Hora: d.HORA_CITA, Celular: d.TEL_MOVIL || '', 
      Centro: d.CENTRO, Servicio: d.SERVICIO, Subactividad: d.SUBACTIVIDAD || 'SIN ESPECIFICAR',
      Profesional: d.PROFESIONAL || '', Periodo: d.PERIODO, 
      Estado_Prog: d.ESTADO_PROGRAMACION, Estado_Cita: d.ESTADO_CITA
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deserción');
    const label = filtroServicio !== 'TODOS' ? `_${filtroServicio.substring(0, 20)}` : '';
    XLSX.writeFile(wb, `desercion${label}.xlsx`);
  };

  const handleManualUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const resp = await fetch('http://localhost:3001/actualizar');
      const data = await resp.json();
      if (data.success) {
        const idx = await loadIndex();
        setMonthsIndex(idx);
        alert("¡Base de Datos consolidada con éxito!");
      } else {
        alert("Error al consolidar: " + data.error);
      }
    } catch (err) {
      alert("Para usar esta función, debes haber iniciado la aplicación usando el archivo 'iniciar-app.bat'.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openModal = (type) => { 
    setModalType(type); 
    setSelectedRecord(null); 
    setPage(1); 
    setFiltroServicio('TODOS'); 
  };

  // ... (charts omitted for brevity in replace_file_content)

  // ── Render Modal Part ──
  // (Moving to next turn or chunk if needed, but I'll try to find the detail form)

  // ── Charts ─────────────────────────────────────────────────────────────────
  const chartDataPrimaryBar = useMemo(() => {
    const agg = {};
    const field = centro === 'TODOS' ? 'CENTRO' : 'SERVICIO';
    dataFiltered.forEach(d => {
      if (d.ESTADO_CITA?.toUpperCase().includes('DESERCION'))
        agg[d[field]] = (agg[d[field]] || 0) + d.TOTAL;
    });
    const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      labels: sorted.map(i => i[0].substring(0, 25)),
      datasets: [{ label: 'Citas No Atendidas / Deserción', data: sorted.map(i => i[1]),
        backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 4 }]
    };
  }, [dataFiltered, centro]);

  const chartDataSecundary = useMemo(() => {
    const agg = {};
    const field = centro === 'TODOS' ? 'SERVICIO' : 'SUBACTIVIDAD';
    dataFiltered.forEach(d => {
      if (d.ESTADO_CITA?.toUpperCase().includes('DESERCION')) {
        const key = d[field] || (field === 'SUBACTIVIDAD' ? 'SIN ESPECIFICAR' : 'DESCONOCIDO');
        agg[key] = (agg[key] || 0) + d.TOTAL;
      }
    });
    const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (centro === 'TODOS') {
      const colors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#6366f1'];
      return { labels: sorted.map(i => i[0].substring(0, 25)),
        datasets: [{ label: 'Servicios con más inasistencias', data: sorted.map(i => i[1]),
          backgroundColor: colors, borderWidth: 0 }] };
    }
    return { labels: sorted.map(i => i[0].substring(0, 25)),
      datasets: [{ label: 'Subactividades con más inasistencias', data: sorted.map(i => i[1]),
        backgroundColor: 'rgba(245, 158, 11, 0.8)', borderRadius: 4 }] };
  }, [dataFiltered, centro]);

  const chartDataProfesional = useMemo(() => {
    const agg = {}, centrosMap = {}, serviciosMap = {};
    dataFiltered.forEach(d => {
      if (!d.ESTADO_CITA?.toUpperCase().includes('DESERCION')) return;
      const k = d.PROFESIONAL || 'SIN PROFESIONAL';
      if (k === 'SIN PROFESIONAL') return;
      agg[k] = (agg[k] || 0) + d.TOTAL;
      if (!centrosMap[k]) centrosMap[k] = {};
      centrosMap[k][d.CENTRO] = (centrosMap[k][d.CENTRO] || 0) + d.TOTAL;
      if (!serviciosMap[k]) serviciosMap[k] = {};
      const srv = d.SERVICIO || 'SIN SERVICIO';
      serviciosMap[k][srv] = (serviciosMap[k][srv] || 0) + d.TOTAL;
    });
    const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const centrosList   = sorted.map(([p]) => Object.entries(centrosMap[p]  || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || '');
    const serviciosList = sorted.map(([p]) => Object.entries(serviciosMap[p]|| {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || '');
    return {
      labels: sorted.map(i => i[0]),
      centros: centrosList, servicios: serviciosList,
      datasets: [{ label: 'Citas No Atendidas por Profesional', data: sorted.map(i => i[1]),
        backgroundColor: 'rgba(24, 113, 185, 0.8)', borderRadius: 4 }]
    };
  }, [dataFiltered]);

  const chartDataDias = useMemo(() => {
    const agg = {};
    detalles.forEach(d => {
      if (!d.ESTADO_CITA?.toUpperCase().includes('DESERCION')) return;
      const mp = periodo === 'TODOS' || d.PERIODO === periodo;
      const mc = centro  === 'TODOS' || d.CENTRO  === centro;
      if (!mp || !mc) return;
      const dia = d.FECHA_CITA ? d.FECHA_CITA.split('/')[0] : null;
      if (!dia || isNaN(parseInt(dia))) return;
      agg[dia] = (agg[dia] || 0) + 1;
    });
    const sorted = Object.entries(agg).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    return {
      labels: sorted.map(i => `Día ${i[0]}`),
      datasets: [{ label: 'Inasistencias', data: sorted.map(i => i[1]),
        borderColor: 'rgba(239, 68, 68, 0.9)', backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 2, pointRadius: 4, tension: 0.3, fill: true }]
    };
  }, [detalles, periodo, centro]);

  const chartDataMeses = useMemo(() => {
    const agg = {};
    detalles.forEach(d => {
      if (!d.ESTADO_CITA?.toUpperCase().includes('DESERCION')) return;
      if (centro !== 'TODOS' && d.CENTRO !== centro) return;
      const mes = d.PERIODO || 'SIN MES';
      if (mes) agg[mes] = (agg[mes] || 0) + 1;
    });

    const mesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const labels = [];
    const inasistencias = [];

    for (let i = 1; i <= 12; i++) {
        const pKey = `${selectedYear}${i.toString().padStart(2, '0')}`;
        labels.push(mesNombres[i-1]);
        inasistencias.push(agg[pKey] || 0);
    }

    return {
      labels,
      datasets: [{ label: 'Inasistencias', data: inasistencias,
        borderColor: 'rgba(239, 68, 68, 0.9)', backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 2, pointRadius: 5, tension: 0.3, fill: true }]
    };
  }, [detalles, centro, selectedYear]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (indexError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#f87171' }}>⚠️ No se encontraron datos</h2>
        <p style={{ maxWidth: '500px', color: '#94a3b8' }}>{indexError}</p>
        <code style={{ background: '#1e293b', padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
          fontSize: '0.9rem', color: '#38bdf8' }}>
          node consolidate-monthly.js
        </code>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <header className="glass-header">
        <div className="header-content">
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/LogoEsSalud.gif" alt="Logo EsSalud"
              style={{ height: '55px', width: 'auto', opacity: 0.95,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))', objectFit: 'contain' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="lucide lucide-activity">
                  <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
                </svg>
                <h1 style={{ margin: 0, lineHeight: 1 }}>EsSalud - Monitoreo de Citas</h1>
              </div>

              <div className="header-controls">
                {/* Año */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <label style={{ fontWeight: 600 }}>Año:</label>
                  <select className="premium-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {/* Centro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <label>Centro:</label>
                  <select className="premium-select" value={centro}
                    onChange={e => { setCentro(e.target.value); setActividad('TODOS'); }}>
                    <option value="TODOS">Todos los Centros</option>
                    {centros.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Periodo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <label>Mes:</label>
                  <select className="premium-select" value={periodo}
                    onChange={e => { 
                      setPeriodo(e.target.value); 
                      setActividad('TODOS');
                      setFiltroFecha(''); // Resetear fecha al cambiar de mes
                    }}>
                    <option value="TODOS">Ver Año Completo</option>
                    {periodos.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                
                {/* Calendario Dashboard (Solo si hay un mes seleccionado) */}
                {periodo !== 'TODOS' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <label>Día:</label>
                    <input 
                      type="date" 
                      className="premium-select"
                      style={{ width: '135px', padding: '0.2rem 0.4rem' }}
                      value={filtroFecha} 
                      onChange={e => setFiltroFecha(e.target.value)}
                    />
                  </div>
                )}
                {/* Actividad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <label>Actividad:</label>
                  <select className="premium-select" value={actividad} onChange={e => setActividad(e.target.value)}>
                    <option value="TODOS">Todas</option>
                    {actividades.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <button 
                  className={`icon-btn ${isUpdating ? 'spinning' : ''}`} 
                  onClick={handleManualUpdate} 
                  title="Actualizar Base de Datos (Consolidar todo)"
                  disabled={isUpdating}
                  style={{ padding: 0 }}
                >
                  <RefreshCw size={14} color={isUpdating ? 'var(--primary-color)' : 'currentColor'} />
                </button>
                <button className="icon-btn" onClick={toggleFullscreen} style={{ padding: 0 }}>
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Barra de meses eliminada a petición del usuario */}

      {/* ── Main ── */}
      <main className="main-content">
        {/* KPIs */}
        <section className="kpi-grid">
          <div className="kpi-card outline-primary">
            <h3>Total Citas General</h3>
            <div className="kpi-value">{kpis.totalCitas.toLocaleString()}</div>
          </div>
          <div className="kpi-card outline-success">
            <h3>Atendidas</h3>
            <div className="kpi-value">{kpis.atendidas.toLocaleString()}</div>
            <div className="kpi-subtext">{((kpis.atendidas / kpis.totalCitas) * 100 || 0).toFixed(1)}% del total</div>
          </div>
          <div className="kpi-card outline-danger clickable" onClick={() => openModal('DESERCION')}>
            <h3>Deserción</h3>
            <div className="kpi-value">{kpis.desercion.toLocaleString()}</div>
            <div className="kpi-subtext">{((kpis.desercion / kpis.totalCitas) * 100 || 0).toFixed(1)}% del total</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--danger-color)' }}>Ver detalle &rarr;</div>
          </div>
          <div className="kpi-card outline-warning clickable" onClick={() => openModal('PENDIENTE')}>
            <h3>Pendientes</h3>
            <div className="kpi-value">{kpis.pendientes.toLocaleString()}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--warning-color)' }}>Ver detalle &rarr;</div>
          </div>
        </section>

        {/* Charts */}
        <section className="charts-grid">
          {/* Chart 1 */}
          <div className="chart-card glass-panel">
            <h2>{centro === 'TODOS' ? 'Citas No Atendidas por Centro (Top 10)' : 'Citas No Atendidas por Servicio (Top 10)'}</h2>
            <p className="chart-desc">{centro === 'TODOS' ? 'Impacto de ausentismo por establecimiento de salud' : 'Impacto de ausentismo por especialidad en este centro'}</p>
            <div className="chart-wrapper">
              <Bar data={chartDataPrimaryBar}
                options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
            </div>
          </div>

          {/* Chart 2 */}
          <div className="chart-card glass-panel flex-center">
            <h2>{centro === 'TODOS' ? 'Citas No Atendidas por Servicio (Top 10)' : 'Citas No Atendidas por Subactividad (Top 10)'}</h2>
            <p className="chart-desc">{centro === 'TODOS' ? 'Distribución de especialidades afectadas' : 'Impacto específico por subactividad'}</p>
            <div className={`chart-wrapper ${centro === 'TODOS' ? 'pie-wrapper' : ''}`}>
              {centro === 'TODOS' ? (
                <Doughnut data={chartDataSecundary}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: { legend: { position: 'right', labels: { color: 'var(--text-color)', font: { family: 'Inter' } } } } }} />
              ) : (
                <Bar data={chartDataSecundary}
                  options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} />
              )}
            </div>
          </div>

          {/* Chart 3 */}
          <div className="chart-card glass-panel full-width-chart">
            <h2>Citas No Atendidas por Profesional (Top 15)</h2>
            <p className="chart-desc">Deserciones asociadas a la agenda de profesionales médicos</p>
            <div className="chart-wrapper" style={{ height: '400px' }}>
              <Bar data={chartDataProfesional}
                options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false },
                    tooltip: { callbacks: { afterLabel: (ctx) => {
                      const c = chartDataProfesional.centros?.[ctx.dataIndex];
                      const s = chartDataProfesional.servicios?.[ctx.dataIndex];
                      const lines = [];
                      if (c) lines.push(`📍 Centro: ${c}`);
                      if (s) lines.push(`🩺 Servicio: ${s}`);
                      return lines;
                    }}}},
                  scales: { x: { beginAtZero: true } } }} />
            </div>
          </div>

          {/* Chart 4 — Tendencia */}
          <div className="chart-card glass-panel full-width-chart">
            <h2>{periodo === 'TODOS' ? 'Evolución de Citas No Atendidas por Mes' : 'Evolución de Citas No Atendidas por Día'}</h2>
            <p className="chart-desc">{periodo === 'TODOS' ? 'Tendencia mensual de inasistencias acumuladas' : 'Tendencia diaria de inasistencias en el período seleccionado'}</p>
            <div className="chart-wrapper" style={{ height: '350px' }}>
              {periodo === 'TODOS' ? (
                <Bar data={{ ...chartDataMeses, datasets: [{ ...chartDataMeses.datasets[0],
                  backgroundColor: 'rgba(54, 162, 235, 0.8)',
                  borderColor:     'rgba(54, 162, 235, 1)',
                  borderWidth: 1, borderRadius: 6 }] }}
                  options={{ responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, font: { size: 14, weight: 'bold' } } },
                      y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
              ) : (
                <Line data={chartDataDias}
                  options={{ responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, font: { size: 14, weight: 'bold' } } },
                      y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Modal ── */}
      {modalType && (
        <div className="modal-overlay" onClick={() => { setModalType(null); setSelectedRecord(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRecord ? 'Detalle Completo del Paciente' : `Detalle de Registros: ${modalType === 'DESERCION' ? 'Deserción' : 'Pendientes'}`}</h2>
              <button className="close-btn" onClick={() => { setModalType(null); setSelectedRecord(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {selectedRecord ? (
                <div className="patient-detail-form">
                  <button className="back-btn" onClick={() => setSelectedRecord(null)}>&larr; Volver a la lista</button>
                  <div className="form-grid">
                    <div className="form-group"><label>DNI</label><div className="form-value" style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{selectedRecord.DOC_PACIENTE}</div></div>
                    <div className="form-group"><label>Paciente</label><div className="form-value" style={{ fontWeight: 600 }}>{selectedRecord.PACIENTE}</div></div>
                    <div className="form-group"><label>Edad / Sexo</label><div className="form-value">{selectedRecord.EDAD} años - {selectedRecord.SEXO}</div></div>
                    <div className="form-group"><label>Último CIE10</label><div className="form-value" style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{selectedRecord.ULTCIE10ATEN || 'SIN REGISTRO'}</div></div>
                    <div className="form-group"><label>Fecha y Hora</label><div className="form-value">{selectedRecord.FECHA_CITA} - {selectedRecord.HORA_CITA}</div></div>
                    <div className="form-group"><label>Celular</label><div className="form-value">{selectedRecord.TEL_MOVIL || '-'}</div></div>
                    <div className="form-group full-width"><label>Centro (Establecimiento de Salud)</label><div className="form-value">{selectedRecord.CENTRO}</div></div>
                    <div className="form-group"><label>Servicio Médico</label><div className="form-value">{selectedRecord.SERVICIO}</div></div>
                    <div className="form-group"><label>Subactividad</label><div className="form-value">{selectedRecord.SUBACTIVIDAD || 'SIN ESPECIFICAR'}</div></div>
                    <div className="form-group"><label>Estado</label>
                      <div className="form-value" style={{ background: 'transparent', padding: '0.2rem', border: 'none' }}>
                        <span className={`status-badge ${selectedRecord.ESTADO_CITA.toLowerCase().includes('desercion') ? 'danger' : 'warning'}`}>{selectedRecord.ESTADO_CITA}</span>
                      </div>
                    </div>
                    <div className="form-group"><label>Periodo</label><div className="form-value">{selectedRecord.PERIODO}</div></div>
                  </div>
                </div>
              ) : (
                <React.Fragment>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem',
                    borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Filtrar por Servicio:</label>
                    <select value={filtroServicio} onChange={e => { setFiltroServicio(e.target.value); setPage(1); }}
                      style={{ flex: 1, minWidth: '200px', maxWidth: '400px', padding: '0.4rem 0.75rem', borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)', background: '#f8fafc', color: 'var(--text-color)', fontSize: '0.85rem', fontFamily: 'Inter,sans-serif' }}>
                      <option value="TODOS">Todos los servicios ({detailData.length} registros)</option>
                      {serviciosDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {/* Filtro de día oculto aquí porque ya está en el dashboard principal */}

                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {filteredDetailData.length} registro{filteredDetailData.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={exportToExcel}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem',
                        background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)',
                        borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}>
                      <FileDown size={16} /> Exportar Excel
                    </button>
                  </div>
                  <div className="data-grid-container">
                    <table className="data-grid text-sm">
                      <thead>
                        <tr>
                          <th>DNI</th><th>Paciente</th><th>Edad</th><th>S</th><th>CIE10</th>
                          <th>Fecha</th><th>Hora</th><th>Celular</th>
                          <th>Centro</th><th>Servicio</th><th>Subactividad</th><th>Profesional</th><th>Per.</th>
                          <th>Prog.</th><th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDetailData.slice((page - 1) * itemsPerPage, page * itemsPerPage).map((row, idx) => (
                          <tr key={idx} className="clickable-row" onClick={() => setSelectedRecord(row)}>
                            <td style={{ fontWeight: 500 }}>{row.DOC_PACIENTE}</td>
                            <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.PACIENTE}>{row.PACIENTE}</td>
                            <td>{row.EDAD}</td>
                            <td>{row.SEXO}</td>
                            <td style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{row.ULTCIE10ATEN}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.FECHA_CITA}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.HORA_CITA}</td>
                            <td>{row.TEL_MOVIL}</td>
                            <td style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.CENTRO}>{row.CENTRO}</td>
                            <td style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.SERVICIO}>{row.SERVICIO}</td>
                            <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.SUBACTIVIDAD || 'SIN ESPECIFICAR'}>{row.SUBACTIVIDAD || 'SIN ESPECIFICAR'}</td>
                            <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.PROFESIONAL || '-'}>{row.PROFESIONAL || '-'}</td>
                            <td>{row.PERIODO}</td>
                            <td title={row.ESTADO_PROGRAMACION}>{row.ESTADO_PROGRAMACION}</td>
                            <td>
                              <span className={`status-badge ${row.ESTADO_CITA.toLowerCase().includes('desercion') ? 'danger' : 'warning'}`} style={{ fontSize: '10px', padding: '1px 4px' }}>
                                {row.ESTADO_CITA}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredDetailData.length === 0 && (
                          <tr><td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay registros para mostrar.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filteredDetailData.length > 0 && !selectedRecord && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Mostrando {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredDetailData.length)} de {filteredDetailData.length} registros
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setPage(Math.max(page - 1, 1))} disabled={page === 1}
                          style={{ padding: '0.4rem 0.8rem', background: page === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(59,130,246,0.2)',
                            color: page === 1 ? 'var(--text-muted)' : 'var(--primary-color)', border: 'none', borderRadius: '0.25rem',
                            cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Anterior</button>
                        <button onClick={() => setPage(Math.min(page + 1, Math.ceil(filteredDetailData.length / itemsPerPage)))}
                          disabled={page >= Math.ceil(filteredDetailData.length / itemsPerPage)}
                          style={{ padding: '0.4rem 0.8rem',
                            background: page >= Math.ceil(filteredDetailData.length / itemsPerPage) ? 'rgba(255,255,255,0.05)' : 'rgba(59,130,246,0.2)',
                            color: page >= Math.ceil(filteredDetailData.length / itemsPerPage) ? 'var(--text-muted)' : 'var(--primary-color)',
                            border: 'none', borderRadius: '0.25rem',
                            cursor: page >= Math.ceil(filteredDetailData.length / itemsPerPage) ? 'not-allowed' : 'pointer' }}>Siguiente</button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default App;
