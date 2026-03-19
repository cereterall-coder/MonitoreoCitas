/**
 * consolidate-monthly.js
 * ======================
 * Genera un JSON consolidado POR MES desde los TXT de "PACIENTES CITADOS EN CONSULTA EXTERNA".
 *
 * Salida → estadisticas-citas/public/data/
 *   consolidado_YYYY-MM.json   → datos agregados (para charts y KPIs)
 *   detalles_YYYY-MM.json      → filas de pacientes con deserción/pendiente (para la tabla modal)
 *   months-index.json          → índice de meses disponibles
 *
 * Lógica de re-procesamiento:
 *   --all         → re-procesa TODOS los meses sin excepción
 *   --month YYYY-MM → procesa sólo ese mes
 *   (sin flags)   → procesa únicamente el mes actual y meses futuros
 *                   (los pasados ya consolidados se saltan para ahorrar tiempo)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Rutas ────────────────────────────────────────────────────────────────────
const BASE_DIR  = path.join(__dirname, '..', '..', 'bot-essalud', 'descargas', 'PACIENTES CITADOS EN CONSULTA EXTERNA');
const OUT_DIR   = path.join(__dirname, '..', 'public', 'data');
const INDEX_FILE = path.join(OUT_DIR, 'months-index.json');

// ─── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const forceAll   = args.includes('--all');
const singleMonth = (() => {
  const i = args.indexOf('--month');
  return i !== -1 ? args[i + 1] : null;
})();

// ─── Helpers ───────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function currentYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Retorna todos los subdirectorios con nombre YYYY-MM dentro de BASE_DIR */
function getAvailableMonthDirs() {
  return fs.readdirSync(BASE_DIR)
    .filter(name => /^\d{4}-\d{2}$/.test(name))
    .map(name => ({ month: name, dir: path.join(BASE_DIR, name) }))
    .filter(({ dir }) => fs.statSync(dir).isDirectory())
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Busca recursivamente archivos .txt */
function findTxtFiles(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files = files.concat(findTxtFiles(full));
    else if (item.toLowerCase().endsWith('.txt')) files.push(full);
  }
  return files;
}

// ─── Procesador de un mes ──────────────────────────────────────────────────────
async function processMonth(monthKey, monthDir) {
  const outConsolidado = path.join(OUT_DIR, `consolidado_${monthKey}.json`);
  const outDetalles    = path.join(OUT_DIR, `detalles_${monthKey}.json`);

  const txtFiles = findTxtFiles(monthDir);
  if (txtFiles.length === 0) {
    console.log(`  ⚠  Sin archivos TXT en ${monthDir}`);
    return { monthKey, totalRows: 0, totalDetalles: 0 };
  }

  console.log(`  📂 ${txtFiles.length} archivos TXT encontrados`);

  const aggregation = new Map();
  const detalles = [];

  for (const file of txtFiles) {
    const fileStream = fs.createReadStream(file);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let header = null;
    let centroIdx = -1, periodoIdx = -1, servicioIdx = -1;
    let actividadIdx = -1, subactividadIdx = -1, profesionalIdx = -1, estadoIdx = -1;
    let docIdx = -1, pacIdx = -1, fechaIdx = -1, horaIdx = -1, tmovilIdx = -1;
    let edadIdx = -1, sexoIdx = -1, cie10Idx = -1; 
    let progIdx = -1; // Nuevo

    for await (const line of rl) {
      if (!line.trim()) continue;
      const cols = line.split('|');

      if (!header) {
        header        = cols;
        centroIdx     = header.indexOf('CENTRO');
        periodoIdx    = header.indexOf('PERIODO');
        servicioIdx   = header.indexOf('SERVICIO');
        actividadIdx  = header.indexOf('ACTIVIDAD');
        subactividadIdx = header.indexOf('SUBACTIVIDAD');
        profesionalIdx = header.indexOf('PROFESIONAL');
        estadoIdx     = header.indexOf('ESTADO_CITA');
        docIdx        = header.indexOf('DOC_PACIENTE');
        pacIdx        = header.indexOf('PACIENTE');
        fechaIdx      = header.indexOf('FECHA_CITA');
        horaIdx       = header.indexOf('HORA_CITA');
        tmovilIdx     = header.indexOf('TEL_MOVIL');
        edadIdx       = header.indexOf('EDAD');
        sexoIdx       = header.indexOf('SEXO');
        cie10Idx      = header.indexOf('ULTCIE10ATEN');
        progIdx       = header.indexOf('ESTADO_PROGRAMACION');
        continue;
      }

      if (centroIdx === -1 || periodoIdx === -1 || servicioIdx === -1 ||
          subactividadIdx === -1 || estadoIdx === -1) continue;

      const estado = cols[estadoIdx]?.trim() ?? '';
      if (!estado || estado.toUpperCase().includes('ANULADA')) continue;

      const progValue = progIdx !== -1 ? (cols[progIdx]?.trim() ?? '') : '';
      if (progValue.toUpperCase() !== 'APROBADA') continue; // Filtrar por Estado de Programación: APROBADA

      // --- FILTRO DE FECHA: SOLO HASTA AYER ---
      const fechaCitaRaw = fechaIdx !== -1 ? (cols[fechaIdx]?.trim() ?? '') : '';
      if (fechaCitaRaw) {
        const [d, m, y] = fechaCitaRaw.split('/');
        const citaDate = new Date(`${y}-${m}-${d}`);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalizar a medianoche para solo comparar dias

        if (citaDate >= today) continue; // Si la cita es hoy o el futuro, ignorar para este dashboard
      }
      // ----------------------------------------

      const centro      = cols[centroIdx]?.trim()  ?? '';
      const periodo     = cols[periodoIdx]?.trim()  ?? '';
      const servicio    = cols[servicioIdx]?.trim() ?? '';
      const actividad   = actividadIdx  !== -1 ? (cols[actividadIdx]?.trim()  ?? '') : '';
      const subactividad = cols[subactividadIdx]?.trim() ?? '';
      const profesional = profesionalIdx !== -1 ? (cols[profesionalIdx]?.trim() ?? 'SIN PROFESIONAL') : 'SIN PROFESIONAL';

      if (!centro || !periodo || !servicio || !subactividad) continue;

      // Agregado
      const key = `${centro}||${periodo}||${servicio}||${actividad}||${subactividad}||${profesional}||${estado}||${fechaCitaRaw}`;
      aggregation.set(key, (aggregation.get(key) || 0) + 1);

      // Detalles sólo para deserción y pendiente
      const estadoUpper = estado.toUpperCase();
      if (estadoUpper.includes('DESERCION') || estadoUpper.includes('PENDIENTE')) {
        detalles.push({
          CENTRO:       centro,
          PERIODO:      periodo,
          SERVICIO:     servicio,
          ACTIVIDAD:    actividad,
          SUBACTIVIDAD: subactividad,
          PROFESIONAL:  profesional,
          ESTADO_CITA:  estado,
          ESTADO_PROGRAMACION: progIdx !== -1 ? (cols[progIdx]?.trim() ?? '') : '',
          DOC_PACIENTE: docIdx  !== -1 ? (cols[docIdx]?.trim()  ?? '') : '',
          PACIENTE:     pacIdx  !== -1 ? (cols[pacIdx]?.trim()  ?? '') : '',
          EDAD:         edadIdx !== -1 ? (cols[edadIdx]?.trim() ?? '') : '',
          SEXO:         sexoIdx !== -1 ? (cols[sexoIdx]?.trim() ?? '') : '',
          ULTCIE10ATEN: cie10Idx !== -1 ? (cols[cie10Idx]?.trim().split('-')[0].trim() ?? '') : '',
          FECHA_CITA:   fechaIdx !== -1 ? (cols[fechaIdx]?.trim() ?? '') : '',
          HORA_CITA:    horaIdx  !== -1 ? (cols[horaIdx]?.trim()  ?? '') : '',
          TEL_MOVIL:    tmovilIdx !== -1 ? (cols[tmovilIdx]?.trim() ?? '') : ''
        });
      }
    }
  }

  // Convertir mapa a array
  const data = [];
  for (const [key, count] of aggregation.entries()) {
    const [centro, periodo, servicio, actividad, subactividad, profesional, estadoCita, fechaCita] = key.split('||');
    data.push({ 
      CENTRO: centro, 
      PERIODO: periodo, 
      SERVICIO: servicio,
      ACTIVIDAD: actividad, 
      SUBACTIVIDAD: subactividad,
      PROFESIONAL: profesional, 
      ESTADO_CITA: estadoCita,
      FECHA_CITA: fechaCita,
      TOTAL: count 
    });
  }

  fs.writeFileSync(outConsolidado, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(outDetalles,    JSON.stringify(detalles, null, 2), 'utf8');

  console.log(`  ✅ consolidado_${monthKey}.json → ${data.length} registros agregados`);
  console.log(`  ✅ detalles_${monthKey}.json    → ${detalles.length} registros detalle`);

  return { monthKey, totalRows: data.length, totalDetalles: detalles.length };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  ensureDir(OUT_DIR);

  const allMonthDirs = getAvailableMonthDirs();
  const today = currentYearMonth();

  console.log(`\n🗓  Mes actual: ${today}`);
  console.log(`📁 Meses disponibles en fuente: ${allMonthDirs.map(m => m.month).join(', ')}\n`);

  // Determinar qué meses procesar
  let toProcess;
  if (singleMonth) {
    const found = allMonthDirs.find(m => m.month === singleMonth);
    if (!found) { console.error(`❌ Mes ${singleMonth} no encontrado`); process.exit(1); }
    toProcess = [found];
    console.log(`🎯 Modo: sólo mes ${singleMonth}\n`);
  } else if (forceAll) {
    toProcess = allMonthDirs;
    console.log(`🔁 Modo: re-procesar TODOS los meses\n`);
  } else {
    // Sólo mes actual y futuros (o aquellos que aún no tienen JSON)
    toProcess = allMonthDirs.filter(({ month }) => {
      if (month >= today) return true; // actual y futuros: siempre
      // Pasados: sólo si aún no existe el JSON consolidado
      const outPath = path.join(OUT_DIR, `consolidado_${month}.json`);
      const exists  = fs.existsSync(outPath);
      if (!exists) console.log(`  ⚠  ${month} no tiene JSON previo → se incluye`);
      return !exists;
    });
    console.log(`⚡ Modo: inteligente — procesando: ${toProcess.map(m => m.month).join(', ') || 'ninguno'}\n`);
  }

  const results = [];
  for (const { month, dir } of toProcess) {
    console.log(`\n📅 Procesando mes: ${month}`);
    const r = await processMonth(month, dir);
    results.push(r);
  }

  // Actualizar el índice de meses (combina existentes + nuevos)
  const existingIndex = fs.existsSync(INDEX_FILE)
    ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    : [];

  const indexMap = new Map(existingIndex.map(e => [e.month, e]));
  for (const r of results) {
    indexMap.set(r.monthKey, {
      month:          r.monthKey,
      consolidado:    `data/consolidado_${r.monthKey}.json`,
      detalles:       `data/detalles_${r.monthKey}.json`,
      totalRows:      r.totalRows,
      totalDetalles:  r.totalDetalles,
      updatedAt:      new Date().toISOString()
    });
  }

  // Asegurar que todos los meses que tienen JSON estén en el índice
  for (const { month } of allMonthDirs) {
    if (!indexMap.has(month)) {
      const consolidated = path.join(OUT_DIR, `consolidado_${month}.json`);
      if (fs.existsSync(consolidated)) {
        indexMap.set(month, {
          month,
          consolidado: `data/consolidado_${month}.json`,
          detalles:    `data/detalles_${month}.json`,
          totalRows:   0,
          totalDetalles: 0,
          updatedAt:   null
        });
      }
    }
  }

  const finalIndex = Array.from(indexMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  fs.writeFileSync(INDEX_FILE, JSON.stringify(finalIndex, null, 2), 'utf8');

  console.log(`\n📋 Índice actualizado → months-index.json`);
  console.log(`   Meses registrados: ${finalIndex.map(e => e.month).join(', ')}`);
  console.log('\n✨ ¡Consolidación completada!\n');
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
