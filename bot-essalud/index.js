const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * ROBOT ESSALUD - VERSION COMPLETA FUNCIONAL
 * - Selección de mes y año
 * - Selección de reportes
 * - Selección de centros
 * - Descarga automática con ingreso de fechas
 */

// Detect if we are running from a packaged EXE
const isPkg = typeof process.pkg !== 'undefined';
const rootPath = isPkg ? path.dirname(process.execPath) : __dirname;

// Detect system proxy for office environments
let PROXY_CONFIG = null;
if (process.platform === 'win32') {
    try {
        const { execSync } = require('child_process');
        // Primero verificar si el proxy está habilitado
        const enableOutput = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', { encoding: 'utf8', stdio: [] });
        const isEnabled = enableOutput.includes('0x1');
        
        if (isEnabled) {
            const proxyOutput = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', { encoding: 'utf8', stdio: [] });
            const match = proxyOutput.match(/ProxyServer\s+REG_SZ\s+(.+)/);
            if (match && match[1]) {
                const proxyUrl = match[1].includes('://') ? match[1] : `http://${match[1]}`;
                PROXY_CONFIG = { server: proxyUrl };
                console.log(`🌐 Proxy detectado y activo: ${PROXY_CONFIG.server}`);
            }
        } else {
            console.log(`🌐 Proxy detectado en el sistema pero está DESACTIVADO. No se usará.`);
        }
    } catch (e) {
        // No proxy or reg key not found
    }
}

let CREDENCIALES = { usuario: '02855470', pass: '02855470Al3' };
const URL_SISTEMA = 'http://appsgasistexpl.essalud.gob.pe/explotaDatos/index.html';
const BASE_DESCARGAS = path.join(rootPath, 'descargas');

let FECHAS = { inicio: '', fin: '' };

const LISTA_CENTROS = [
    { texto: "CAP I CASCAS", valor: "219" },
    { texto: "CAP I CHICAMA", valor: "220" },
    { texto: "CAP I MALABRIGO", valor: "228" },
    { texto: "CAP I SALAVERRY", valor: "231" },
    { texto: "CAP I SAN P. DE LLOC", valor: "235" },
    { texto: "CAP II GUADALUPE", valor: "223" },
    { texto: "CAP II HUAMACHUCO", valor: "224" },
    { texto: "CAP II LAREDO", valor: "226" },
    { texto: "CAP II OTUZCO", valor: "229" },
    { texto: "CAP II SOLEDAD", valor: "239" },
    { texto: "CAP II TAYABAMBA", valor: "240" },
    { texto: "CAP III MET.TRUJILLO", valor: "484" },
    { texto: "C.M. ASCOPE", valor: "209" },
    { texto: "C.M. ESP.CASA GRANDE", valor: "429" },
    { texto: "C.M. HUANCHACO", valor: "442" },
    { texto: "H.I ALBRECHT", valor: "207" },
    { texto: "H.I FLORENCIA MORA", valor: "211" },
    { texto: "H.I LA ESPERANZA", valor: "212" },
    { texto: "H.I MOCHE", valor: "213" },
    { texto: "H.I PACASMAYO", valor: "208" },
    { texto: "H.I VICTOR SOLES G.", valor: "241" },
    { texto: "H.II CHOCOPE", valor: "206" },
    { texto: "H.IV V. LAZARTE", valor: "205" },
    { texto: "HOSP. V.DE LA PUERTA", valor: "671" },
    { texto: "P.M. CARTAVIO", valor: "218" },
    { texto: "P.M. CHAO", valor: "444" },
    { texto: "P.M. JEQUETEPEQUE", valor: "225" },
    { texto: "P.M. LIMONCARRO", valor: "227" },
    { texto: "P.M. PAIJAN", valor: "432" },
    { texto: "P.M. QUIRUVILCA", valor: "230" },
    { texto: "P.M. S. DE CHUCO", valor: "236" },
    { texto: "P.M. SAN JOSE", valor: "233" },
    { texto: "P.M. SANTIAGO DE CAO", valor: "433" },
    { texto: "P.M. SAUSAL", valor: "237" },
    { texto: "POL. EL PORVENIR", valor: "210" },
    { texto: "POL. V.LARCO HERRERA", valor: "443" }
];

const REPORTES_CONFIG = [
    {
        id: "horas",
        label: "HORAS EFECTIVAS - CERETE",
        carpeta: "HORAS EFECTIVAS - CERETE",
        opt: "hefectivas",
        formato: "TXT"
    },
    {
        id: "pacientes",
        label: "PACIENTES CITADOS EN CONSULTA EXTERNA",
        carpeta: "PACIENTES CITADOS EN CONSULTA EXTERNA",
        opt: "adm16",
        formato: "TXT"
    },
    {
        id: "cantidad_tipo",
        label: "CANTIDAD X TIPO DE CITAS",
        carpeta: "CANTIDAD X TIPO DE CITAS",
        opt: "adm13",
        formato: "PDF"
    },
    {
        id: "atendidos_topico",
        label: "PACIENTES ATENDIDOS POR TOPICO",
        carpeta: "ATENDIDOS POR TOPICO",
        opt: "emerg14",
        formato: "TXT"
    },
    {
        id: "perfil_cex",
        label: "PERFIL DE CEX (Todos los Dx)",
        carpeta: "PERFILES CEX",
        opt: "cext7",
        formato: "TXT"
    },
    {
        id: "perfil_hos",
        label: "PERFIL DE HOS",
        carpeta: "PERFILES HOS",
        opt: "hospital_21C",
        formato: "TXT"
    },
    {
        id: "perfil_eme",
        label: "PERFIL DE EME",
        carpeta: "PERFILES EME",
        opt: "emerg21",
        formato: "TXT"
    },
    {
        id: "atenciones_paciente",
        label: "ATENCIONES POR PACIENTE",
        carpeta: "ATENCIONES POR PACIENTE",
        opt: "cext13",
        formato: "TXT"
    }
];

function calcularFechas(mes, anio) {
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);

    const format = (f) => {
        const dd = String(f.getDate()).padStart(2, '0');
        const mm = String(f.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${anio}`;
    };

    return {
        inicio: format(primerDia),
        fin: format(ultimoDia)
    };
}

function getNombreArchivo(centro, mes, anio, formato) {
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const ext = formato === 'PDF' ? 'pdf' : 'txt';
    return `${centro.valor}_${centro.texto.replace(/[^a-zA-Z0-9]/g, '_')}_${meses[mes]}_${anio}.${ext}`;
}

const CONFIG_FILE = path.join(rootPath, 'config_cerete.json');

function cargarConfigCerete() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (Array.isArray(data)) return { centros: data, rutaDestino: '', usuario: '', pass: '' };
            return {
                centros: data.centros || [],
                rutaDestino: data.rutaDestino || '',
                usuario: data.usuario || '',
                pass: data.pass || ''
            };
        }
        catch (e) { return { centros: [], rutaDestino: '', usuario: '', pass: '' }; }
    }
    return { centros: [], rutaDestino: '', usuario: '', pass: '' };
}

function guardarConfigCerete(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const ESPECIALIDADES_FILE = path.join(rootPath, 'especialidades.json');

let ROBOT_STOP = false;

async function mostrarMenuGUI() {
    console.log("🖥️ Abriendo Panel de Control...");
    const browser = await chromium.launch({
        headless: false,
        channel: 'msedge',
        proxy: PROXY_CONFIG || undefined
    });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1150, height: 620 });

    const now = new Date();
    const mesActual = now.getMonth();
    const anioActual = now.getFullYear();
    let configCerete = cargarConfigCerete();
    let centrosCerete = configCerete.centros;
    let rutaDestino = configCerete.rutaDestino;
    let usuarioGuardado = configCerete.usuario || CREDENCIALES.usuario;
    let passGuardada = configCerete.pass || CREDENCIALES.pass;

    const htmlContent = `
    <html>
    <head>
        <style>
            :root {
                --primary: #00f2fe; --secondary: #4facfe; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #38bdf8;
            }
            html, body { 
                height: 100%; margin: 0; background: var(--bg); color: var(--text); 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden;
            }
            body { 
                padding: 10px; display: flex; flex-direction: column; box-sizing: border-box;
            }
            .header { 
                display: flex; justify-content: space-between; align-items: center; 
                margin-bottom: 8px; flex-shrink: 0;
            }
            .header h1 { margin: 0; font-size: 18px; font-weight: 600; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            
            .btn-config {
                background: #334155; border: none; color: white;
                padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
            }
            .content-wrapper { flex: 1; display: flex; flex-direction: column; min-height: 0; gap: 10px; }
            .card-top { background: var(--card); border-radius: 10px; padding: 8px; border: 1px solid #334155; flex-shrink: 0; }
            .main-container { display: grid; grid-template-columns: 280px 1fr; gap: 10px; flex: 1; min-height: 0; }
            .card { background: var(--card); border-radius: 10px; padding: 10px; border: 1px solid #334155; display: flex; flex-direction: column; min-height: 0; }
            .card h3 { margin: 0 0 6px; font-size: 12px; color: var(--accent); text-transform: uppercase; }
            .scroll-area { flex: 1; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; scrollbar-color: #475569 transparent; }
            .scroll-area::-webkit-scrollbar { width: 4px; }
            .scroll-area::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
            .centers-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
            .row-period { display: flex; gap: 8px; align-items: center; }
            .input-group { flex: 1; }
            label { display: block; font-size: 10px; color: #94a3b8; }
            select, input[type="number"] { width: 100%; background: #0f172a; border: 1px solid #334155; color: white; padding: 5px; border-radius: 6px; font-family: inherit; font-size: 12px; }
            .item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px; transition: background 0.2s; cursor: pointer; }
            .item:hover { background: #334155; }
            .item input[type="checkbox"] { width: 14px; height: 14px; accent-color: var(--primary); }
            .item label { margin: 0; color: var(--text); font-size: 11px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .btn-all, .btn-cerete { background: transparent; border: 1px solid var(--accent); color: var(--accent); padding: 3px 8px; border-radius: 6px; cursor: pointer; font-size: 10px; margin-left: 4px; }
            .btn-cerete { border-color: #fbbf24; color: #fbbf24; }
            .btn-start { flex: 1; background: linear-gradient(135deg, var(--primary), var(--secondary)); border: none; color: #0f172a; font-weight: 700; font-size: 13px; padding: 10px; border-radius: 8px; cursor: pointer; }
            .btn-stop { background: #ef4444; color: white; border: none; font-weight: 700; font-size: 13px; padding: 10px; border-radius: 8px; cursor: pointer; display: none; margin-left:10px;}
            #loopOption { display: none; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.1); padding: 5px 10px; border-radius: 6px; border: 1px dashed var(--accent); margin-right: 10px; }
            #loopOption label { color: var(--accent); font-weight: 600; font-size: 11px; cursor: pointer; }
            
            #modalConfig { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; padding: 20px; display: none; align-items: center; justify-content: center; }
            .modal-content { background: var(--card); border-radius: 12px; width: 95%; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column; padding: 15px; border: 1px solid var(--accent); }
            .status-bar { font-size: 11px; color: #94a3b8; margin-top: 5px; text-align: center; }

            /* Modal Finalizado */
            #modalFinish { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 200; padding: 20px; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
            .finish-content { background: var(--card); border-radius: 16px; width: 400px; padding: 30px; border: 1px solid var(--primary); text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
            .finish-icon { font-size: 50px; margin-bottom: 20px; display: block; }
            .finish-btns { display: flex; flex-direction: column; gap: 12px; margin-top: 25px; }
            /* Tarjeta de Estado de Descarga */
            #statusCard { 
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                width: 380px; background: rgba(30, 41, 59, 0.95); backdrop-filter: blur(10px);
                border: 1px solid var(--primary); border-radius: 12px; 
                padding: 15px; z-index: 300; display: none; opacity: 0;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                transition: opacity 0.4s;
            }
            .status-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
            .status-dot { width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1.5s infinite; }
            .status-title { font-size: 14px; font-weight: 600; color: var(--primary); }
            .status-info { font-size: 12px; color: var(--text); font-weight: 600; }
            .status-file { font-size: 11px; color: #94a3b8; margin-top: 4px; font-style: italic; }
            @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
            
            .footer-authorship {
                position: fixed;
                bottom: 15px;
                right: 20px;
                text-align: right;
                font-size: 9px;
                color: #94a3b8;
                line-height: 1.4;
                pointer-events: none;
                z-index: 50;
                background: rgba(15, 23, 42, 0.4);
                padding: 8px 12px;
                border-radius: 10px;
                border: 1px solid rgba(56, 189, 248, 0.1);
                backdrop-filter: blur(8px);
                transition: opacity 0.3s;
            }
            .footer-authorship b { color: var(--accent); font-weight: 600; font-size: 10px; display: block; margin-bottom: 2px; }
        </style>
    </head>
    <body onclick="if(event.target.id==='modalConfig') cerrarConfig()">
        <div class="header">
            <h1>Panel de Control Robot</h1>
            <button class="btn-config" onclick="abrirConfig()">⚙️ Configurar CERETE</button>
        </div>

        <div class="content-wrapper">
            <div class="card-top">
                <div class="row-period">
                    <div class="input-group">
                        <label>Mes de Reporte</label>
                        <select id="mes">
                            ${["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            .map((m, i) => `<option value="${i}" ${i === mesActual ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Año</label>
                        <input type="number" id="anio" value="${anioActual}" />
                    </div>
                    <div id="loopOption">
                        <input type="checkbox" id="repetirBucle">
                        <label for="repetirBucle">REPETIR BUCLE (Horas)</label>
                    </div>
                    <div id="speakOption" style="display: flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.1); padding: 5px 10px; border-radius: 6px; border: 1px dashed var(--accent); margin-right: 10px;">
                        <input type="checkbox" id="hablarDescarga">
                        <label for="hablarDescarga" style="color:var(--accent); font-weight:600; font-size:11px; cursor:pointer;">NARRAR 🔊</label>
                    </div>
                </div>
                <div class="row-period" style="margin-top: 5px;">
                    <div class="input-group">
                        <label>Usuario EsSalud</label>
                        <input type="text" id="usuario" value="${usuarioGuardado}" placeholder="DNI" />
                    </div>
                    <div class="input-group">
                        <label>Contraseña</label>
                        <input type="password" id="pass" value="${passGuardada}" placeholder="********" />
                    </div>
                    <div style="flex: 2; align-self: flex-end; display:flex;">
                        <button id="btnStart" class="btn-start">INICIAR PROCESO DE DESCARGA</button>
                        <button id="btnStop" class="btn-stop">DETENER ROBOT</button>
                    </div>
                </div>
                <div id="statusBar" class="status-bar">Esperando selección...</div>
            </div>

            <div class="main-container">
                <div class="card">
                    <h3>Reportes</h3>
                    <div class="scroll-area">
                        ${REPORTES_CONFIG.map(r => `
                            <div class="item" onclick="handleRepClick(event, '${r.id}')">
                                <input type="checkbox" id="rep_${r.id}" value="${r.id}" class="rep" onchange="actualizarBucle()" onclick="event.stopPropagation()">
                                <label style="cursor:pointer; flex:1" title="${r.label}">${r.label}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <h3 style="margin:0;">Establecimientos</h3>
                        <div style="display:flex;">
                            <button class="btn-cerete" onclick="seleccionarCerete()">Solo CERETE</button>
                            <button class="btn-all" onclick="seleccionarTodos()">Todos</button>
                            <button class="btn-all" style="border-color:#ef4444; color:#ef4444;" onclick="limpiarTodos()">Limpiar</button>
                        </div>
                    </div>
                    <div class="scroll-area">
                        <div class="centers-grid">
                            ${LISTA_CENTROS.map(c => `
                                <div class="item" onclick="toggleCheck('c_${c.valor}')">
                                    <input type="checkbox" id="c_${c.valor}" value="${c.valor}" class="centro" onclick="event.stopPropagation()">
                                    <label title="${c.texto}">${c.texto}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL DE CONFIGURACION -->
        <div id="modalConfig">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h2 style="margin:0; font-size:18px; color:var(--primary);">Configuración CERETE</h2>
                    <p style="font-size:11px; color:#94a3b8; margin:0;">Selecciona tus centros de trabajo habitual.</p>
                </div>
                <div class="scroll-area" style="border:1px solid #334155; padding:8px; border-radius:8px; background:#0f172a; min-height:0;">
                    <div class="centers-grid">
                        ${LISTA_CENTROS.map(c => `
                            <div class="item" style="padding:4px 6px;" onclick="toggleCheck('cfg_${c.valor}')">
                                <input type="checkbox" id="cfg_${c.valor}" value="${c.valor}" class="cfg-centro" 
                                    ${centrosCerete.includes(c.valor) ? 'checked' : ''} onclick="event.stopPropagation()">
                                <label style="font-size:11px;">${c.texto}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="margin-top:10px; background:rgba(56, 189, 248, 0.05); border:1px solid #334155; padding:10px; border-radius:8px;">
                    <label style="font-size:11px; margin-bottom:5px; display:block; color:var(--accent);">Ruta de Destino (Copia de JSON Consolidado):</label>
                    <input type="text" id="cfg_rutaDestino" value="${rutaDestino}" style="width:100%;" placeholder="C:\\ruta\\donde\\copiar\\el\\archivo.json" />
                </div>
                <div style="margin-top:10px; display:flex; gap:10px; flex-shrink:0;">
                    <button class="btn-start" style="padding:10px; font-size:13px;" onclick="guardarConfig()">GUARDAR CAMBIOS</button>
                    <button class="btn-all" style="padding:10px; font-size:13px; border-color:#ef4444; color:#ef4444;" onclick="cerrarConfig()">CERRAR</button>
                </div>
            </div>
        </div>

        <!-- MODAL PROCESO TERMINADO -->
        <div id="modalFinish">
            <div class="finish-content">
                <span class="finish-icon">🚀</span>
                <h2 style="margin:0; font-size:22px; color:var(--primary);">¡Proceso Terminado!</h2>
                <p style="color:#94a3b8; margin:10px 0 0; font-size:14px;">El robot ha completado todas las tareas asignadas.</p>
                <div class="finish-btns">
                    <button class="btn-start" style="padding:12px;" onclick="window.otroProceso()">🔄 EJECUTAR OTRO PROCESO</button>
                    <button class="btn-all" style="padding:12px; border-color:#ef4444; color:#ef4444;" onclick="window.forceExit()">🛑 SALIR DEL ROBOT</button>
                </div>
            </div>
        </div>

        <!-- TARJETA DE ESTADO -->
        <div id="statusCard">
            <div class="status-header">
                <div class="status-dot"></div>
                <div class="status-title">Descargando Reporte...</div>
            </div>
            <div id="statusCentro" class="status-info">Iniciando descarga...</div>
            <div id="statusArchivo" class="status-file">espere un momento...</div>
        </div>

        <div class="footer-authorship">
            <b>Amaro Alexisy Vilela Vargas</b><br>
            Ing. de Sistemas - OSI - R.A. La Libertad<br>
            amalviva@gmail.com - Tfno: 944499069
        </div>

        <script>
            let LISTA_CERETE = ${JSON.stringify(centrosCerete)};
            let RUTA_DESTINO = "${rutaDestino.replace(/\\/g, '\\\\')}";

            function toggleCheck(id) {
                const cb = document.getElementById(id);
                if(cb) cb.checked = !cb.checked;
            }

            function handleRepClick(e, id) {
                const cb = document.getElementById('rep_' + id);
                if (e.target.tagName !== 'INPUT') {
                    cb.checked = !cb.checked;
                    actualizarBucle();
                }
            }

            function actualizarBucle() {
                try {
                    const cbHoras = document.getElementById('rep_horas');
                    const loopOpt = document.getElementById('loopOption');
                    if (cbHoras && loopOpt) {
                        loopOpt.style.display = cbHoras.checked ? 'flex' : 'none';
                        if (!cbHoras.checked) {
                            const rb = document.getElementById('repetirBucle');
                            if (rb) rb.checked = false;
                        }
                    }

                    // Selección automática para Atendidos por Tópico, HOS y EME
                    const cbTopico = document.getElementById('rep_atendidos_topico');
                    const cbHos = document.getElementById('rep_perfil_hos');
                    const cbEme = document.getElementById('rep_perfil_eme');

                    if ((cbTopico && cbTopico.checked) || (cbHos && cbHos.checked) || (cbEme && cbEme.checked)) {
                        const centrosEspeciales = ['207', '671', '209', '444', '206', '210', '429', '211', '212', '213', '208', '205', '241'];
                        centrosEspeciales.forEach(id => {
                            const cb = document.getElementById('c_' + id);
                            if (cb && !cb.disabled) cb.checked = true;
                        });
                    }
                } catch (err) {
                    console.error("Error en actualizarBucle:", err);
                }
            }

            function abrirConfig() { document.getElementById('modalConfig').style.display = 'flex'; }
            function cerrarConfig() { document.getElementById('modalConfig').style.display = 'none'; }
            function seleccionarCerete() { document.querySelectorAll('.centro').forEach(c => c.checked = LISTA_CERETE.includes(c.value)); }
            function seleccionarTodos() { document.querySelectorAll('.centro').forEach(c => c.checked = true); }
            function limpiarTodos() { document.querySelectorAll('.centro').forEach(c => c.checked = false); }

            async function guardarConfig() {
                try {
                    const seleccionados = Array.from(document.querySelectorAll('.cfg-centro:checked')).map(c => c.value);
                    const ruta = document.getElementById('cfg_rutaDestino').value;
                    await window.saveCerete({ centros: seleccionados, rutaDestino: ruta });
                    LISTA_CERETE = seleccionados;
                    RUTA_DESTINO = ruta;
                    alert("✅ Configuración guardada correctamente");
                    cerrarConfig();
                } catch(e) { alert("Error guardando config: " + e.message); }
            }

            function stopRobot() {
                window.detener();
                document.getElementById('statusBar').innerText = "🛑 Deteniendo al terminar descarga actual...";
                document.getElementById('btnStop').disabled = true;
                document.getElementById('btnStop').innerText = "DETENIENDO...";
            }

            async function iniciarRobot(){
                try {
                    const mes = document.getElementById('mes').value;
                    const anio = document.getElementById('anio').value;
                    const usuario = document.getElementById('usuario').value.trim();
                    const pass = document.getElementById('pass').value.trim();
                    const reps = Array.from(document.querySelectorAll('.rep:checked')).map(r=>r.value);
                    const centros = Array.from(document.querySelectorAll('.centro:checked')).map(c=>c.value);
                    const repetir = document.getElementById('repetirBucle').checked;
                    const hablar = document.getElementById('hablarDescarga').checked;
                    
                    if(!usuario || !pass) return alert("⚠️ Ingresa tus credenciales de EsSalud");
                    if(reps.length===0) return alert("⚠️ Selecciona un reporte");
                    if(centros.length===0) return alert("⚠️ Selecciona un centro");
                    
                    document.getElementById('btnStart').disabled = true;
                    document.getElementById('btnStart').style.opacity = '0.5';
                    
                    document.querySelectorAll('input, select, button').forEach(el => {
                        if(el.id !== 'btnStop' && !el.classList.contains('cfg-centro')) el.disabled = true;
                    });
                    
                    document.getElementById('btnStop').style.display = 'block';
                    document.getElementById('statusBar').innerText = "🚀 Robot en ejecución...";
                    
                    window.enviar({mes, anio, usuario, pass, reps, centros, repetir, hablar});
                } catch (e) {
                    alert("❌ Error al iniciar: " + e.message);
                }
            }

            window.otroProceso = function() {
                document.getElementById('modalFinish').style.display = 'none';
                limpiarUI(); 
            };

            function limpiarUI() {
                document.getElementById('btnStart').disabled = false;
                document.getElementById('btnStop').style.display = 'none';
                document.getElementById('btnStop').disabled = false;
                document.getElementById('btnStop').innerText = "DETENER ROBOT";
                document.querySelectorAll('input, select, button').forEach(el => {
                    if(!el.classList.contains('cfg-centro')) el.disabled = false;
                });
                document.getElementById('statusBar').innerText = "Esperando nueva selección...";
                actualizarBucle();
            }

            window.terminado = () => {
                document.querySelectorAll('#modalFinish button').forEach(b => b.disabled = false);
                document.getElementById('modalFinish').style.display = 'flex';
                document.getElementById('statusBar').innerText = "✅ Proceso finalizado.";
            };

            window.updateStatus = (centro, archivo, visible, actual, total) => {
                const card = document.getElementById('statusCard');
                if(!visible) {
                    card.style.opacity = '0';
                    setTimeout(() => { card.style.display = 'none'; }, 400);
                    return;
                }
                const progress = actual ? \` (\${actual} de \${total})\` : '';
                card.querySelector('.status-title').innerText = "Descargando Reporte" + progress + "...";
                document.getElementById('statusCentro').innerText = centro;
                document.getElementById('statusArchivo').innerText = archivo;
                card.style.display = 'block';
                setTimeout(() => card.style.opacity = '1', 10);
            };

            window.hablar = (texto) => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const msg = new SpeechSynthesisUtterance(texto);
                    msg.lang = 'es-ES';
                    msg.rate = 1.0;
                    window.speechSynthesis.speak(msg);
                }
            };

            // Vincular eventos manualmente
            document.getElementById('btnStart').addEventListener('click', iniciarRobot);
            document.getElementById('btnStop').addEventListener('click', stopRobot);
        </script>
    </body>
    </html>
    `;

    let resolveEnviar = null;
    await page.exposeFunction('saveCerete', (config) => guardarConfigCerete(config));
    await page.exposeFunction('detener', () => { ROBOT_STOP = true; });
    await page.exposeFunction('forceExit', () => {
        console.log("🛑 Cerrando el robot por solicitud del usuario...");
        process.exit(0);
    });
    await page.exposeFunction('enviar', (data) => {
        if (resolveEnviar) resolveEnviar(data);
    });

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    return {
        page,
        browser,
        esperarSiguiente: () => new Promise(resolve => { resolveEnviar = resolve; })
    };
}

async function ejecutarDescarga(centro, reporte, mes, anio, creds, gui) {
    const mesPad = (mes + 1).toString().padStart(2, '0');
    const carpetaMes = `${anio}-${mesPad}`;
    const carpetaFinal = path.join(BASE_DESCARGAS, reporte.carpeta, carpetaMes);
    if (!fs.existsSync(carpetaFinal)) fs.mkdirSync(carpetaFinal, { recursive: true });



    console.log(`\n>>> ${reporte.label}: ${centro.texto}`);
    if (PROXY_CONFIG) console.log(`🛰️ Usando proxy: ${PROXY_CONFIG.server}`);

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50,
        channel: 'msedge',
        proxy: PROXY_CONFIG || undefined
    });
    const page = await browser.newPage();
    
    // Capturar alertas del sistema (ej: "No hay datos", "Error de servidor")
    page.on('dialog', async dialog => {
        const msg = dialog.message();
        console.log(`💬 Alerta del sistema: ${msg}`);
        if (gui) {
            await gui.page.evaluate((m) => {
                document.getElementById('statusBar').innerText = "⚠️ Alerta: " + m;
            }, msg);
        }
        await dialog.dismiss();
    });

    try {
        console.log(`🌐 Navegando a: ${URL_SISTEMA}`);
        await page.goto(URL_SISTEMA, { waitUntil: 'load', timeout: 60000 });
        const findFrameBySelector = async (selector) => {
            for (let i = 0; i < 40; i++) { // Aumentado de 20 a 40 (20 segundos)
                for (const f of page.frames()) {
                    if (await f.locator(selector).isVisible().catch(() => false)) return f;
                }
                await page.waitForTimeout(500);
            }
            return null;
        };

        let fLogin = await findFrameBySelector('input[name="USER"]');
        if (!fLogin) throw new Error('Login no encontrado');

        await fLogin.locator('input[name="USER"]').click();
        await fLogin.locator('input[name="USER"]').fill(creds.usuario);
        await fLogin.locator('input[name="PASS"]').click();
        await fLogin.locator('input[name="PASS"]').fill(creds.pass);
        await fLogin.locator('input[name="PASS"]').press('Enter');
        // Fallback: click button if Enter didn't work
        await fLogin.locator('input[value*="Ingresar"]').click().catch(() => { });

        let fSelect = await findFrameBySelector('select');
        if (!fSelect) throw new Error('Selector centro no encontrado');
        await fSelect.locator('select').selectOption(centro.valor);
        await page.waitForTimeout(500);
        await fSelect.locator('input[value*="Ingresar"]').click();
        
        console.log(`🚀 Navegando directamente al reporte: ${reporte.label}`);
        const urlDirecta = `http://appsgasistexpl.essalud.gob.pe/explotaDatos/servlet/CtrlControl?opt=${reporte.opt}`;
        await page.goto(urlDirecta, { waitUntil: 'load', timeout: 30000 });
        console.log("⏳ Esperando que cargue el formulario (5s)...");
        await page.waitForTimeout(5000); 

        const findAndClick = async (pattern) => {
            console.log(`🔍 Buscando: ${pattern}`);
            const isSelector = pattern.startsWith('#') || pattern.startsWith('.') || pattern.startsWith('[') || pattern.includes('>');
            
            for (let i = 0; i < 40; i++) { 
                for (const fr of page.frames()) {
                    try {
                        const el = isSelector ? fr.locator(pattern).first() : fr.locator(`text=/${pattern}/i`).first();
                        const count = await el.count().catch(() => 0);
                        
                        if (count > 0) {
                            // Para selectores de ID, intentamos un clic inicial vía JS para asegurar activación de eventos
                            if (isSelector) {
                                await el.evaluate(node => {
                                    node.click();
                                    const evt = new MouseEvent('mouseover', { bubbles: true });
                                    node.dispatchEvent(evt);
                                }).catch(() => {});
                            }

                            if (await el.isVisible().catch(() => false)) {
                                console.log(`✅ Detectado y Visible: ${pattern}`);
                                await el.hover().catch(() => {});
                                await page.waitForTimeout(300);
                                
                                try {
                                    // Clic forzado para ignorar bloqueos de otros elementos
                                    await el.click({ force: true, timeout: 5000 });
                                } catch (e) {
                                    // Fallback final: Clic por despacho de eventos
                                    await el.evaluate(e => {
                                        const target = e.closest('td, a, button, div[onclick]') || e;
                                        target.click();
                                        const opts = { bubbles: true, cancelable: true, view: window };
                                        target.dispatchEvent(new MouseEvent('mousedown', opts));
                                        target.dispatchEvent(new MouseEvent('mouseup', opts));
                                    });
                                }
                                return fr;
                            }
                        }
                    } catch (e) { }
                }
                await page.waitForTimeout(500);
            }
            return null;
        };



        let fRep = null;
        for (let i = 0; i < 20; i++) { // Aumentado a 20 intentos (aprox 40 segundos)
            for (const fr of page.frames()) {
                const results = await fr.evaluate(() => {
                    const inputs = document.querySelectorAll('input, select, button');
                    return {
                        count: inputs.length,
                        visible: Array.from(inputs).some(i => (i.offsetWidth > 0 || i.offsetHeight > 0))
                    };
                }).catch(() => ({count:0, visible:false}));
                
                if (results.count >= 2 || (results.count >= 1 && results.visible)) { 
                    fRep = fr; 
                    break; 
                }
            }
            if (fRep) break;
            await page.waitForTimeout(2000);
        }

        if (!fRep) {
            console.log("\n🔍 DEBUG: No se encontró el formulario. Buscando elementos interactivos en frames:");
            for (const [idx, fr] of page.frames().entries()) {
                const els = await fr.evaluate(() => 
                    Array.from(document.querySelectorAll('input, select, button'))
                        .map(e => (e.value || e.name || e.id || e.innerText).trim().slice(0, 50))
                ).catch(() => []);
                if (els.length > 0) console.log(`   - Capa ${idx} (${fr.name()}): ${els.join(' | ')}`);
            }
            throw new Error('Formulario no encontrado');
        }
        const setDate = async (np, val) => {
            const inp = await fRep.$(`input[name*="${np}" i], input[id*="${np}" i]`);
            if (inp) {
                await inp.click({ clickCount: 3 });
                await page.keyboard.press('Backspace');
                await inp.fill(val);
                await page.keyboard.press('Tab');
            }
        };

        await setDate('FechaIni', FECHAS.inicio);
        await setDate('FechaFin', FECHAS.fin);
        await page.waitForTimeout(2000);

        const selects = await fRep.$$('select');
        for (const s of selects) {
            const opts = await s.$$eval('option', os => os.map(o => o.innerText.trim()));
            const name = await s.getAttribute('name').catch(() => '');
            
            // Selección específica para Atenciones por Paciente según solicitud del usuario
            if (reporte.id === 'atenciones_paciente') {
                if (name === 'tipoReporte') {
                    const idx = opts.findIndex(t => t.toUpperCase().includes('MEDICO'));
                    if (idx !== -1) await s.selectOption({ index: idx });
                    continue;
                }
                if (name === 'tipo') {
                    const idx = opts.findIndex(t => t.toUpperCase().includes('SUBACTIVIDAD'));
                    if (idx !== -1) await s.selectOption({ index: idx });
                    continue;
                }
                if (name === 'servicio') {
                    const idx = opts.findIndex(t => t.toUpperCase().includes('TODOS'));
                    if (idx !== -1) await s.selectOption({ index: idx });
                    continue;
                }
            }

            let idx = -1;
            if (reporte.formato === 'PDF') idx = opts.findIndex(t => t.includes('*.PDF'));
            else idx = opts.findIndex(t => t.includes('*.TXT') && t.includes('XLS'));
            if (idx !== -1) { await s.selectOption({ index: idx }); break; }
        }

        await page.waitForTimeout(2000);
        if (gui) {
            await gui.page.evaluate(({ c }) => {
                document.getElementById('statusBar').innerText = `⏳ Servidor procesando ${c}... (Espera de 1-10 min)`;
                window.updateStatus(c, "Generando reporte pesado...", true);
            }, { c: centro.texto });
        }

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 600000 }).catch(() => null),
            fRep.locator('input[value*="Imprimir" i], input[type="submit"]').first().click()
        ]);

        if (download) {
            const originalName = download.suggestedFilename();
            const centroLimpio = centro.texto.replace(/[^a-zA-Z0-9]/g, '_');
            const finalName = `${centroLimpio}_${originalName}`;
            const finalDest = path.join(carpetaFinal, finalName);
            
            await download.saveAs(finalDest);
            console.log(`✅ DESCARGADO: ${finalName}`); 
        } else {
            throw new Error('No se generó descarga (Tiempo de espera agotado)');
        }

    } catch (e) {
        console.log(`⚠ ERROR: ${e.message}`);
        try {
            const errName = `error_${centro.valor}_${Date.now()}.png`;
            await page.screenshot({ path: path.join(rootPath, errName), fullPage: true });
            console.log(`📸 Captura de error guardada: ${errName}`);
        } catch (err) { }
    } finally {
        await browser.close().catch(() => { });
    }
}

function parsearArchivo(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];
        const firstLine = lines[0];
        const sep = firstLine.includes('|') ? '|' : '\t';
        const header = firstLine.split(sep).map(h => h.trim().replace(/"/g, ''));
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''));
            const obj = {};
            header.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
            results.push(obj);
        }
        return results;
    } catch (e) { return []; }
}

async function consolidarMes(reporte, mes, anio) {
    const listCSV = ['atendidos_topico', 'perfil_cex', 'perfil_hos', 'perfil_eme', 'atenciones_paciente'];
    if (reporte.id !== 'horas' && !listCSV.includes(reporte.id)) return;
    const mesPad = (mes + 1).toString().padStart(2, '0');
    const carpetaMes = `${anio}-${mesPad}`;
    const dir = path.join(BASE_DESCARGAS, reporte.carpeta, carpetaMes);
    
    if (!fs.existsSync(dir)) {
        console.log(`⚠ No se encontró el directorio: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.txt') && !f.includes('consolidado'));
    console.log(`\n📦 Consolidando: ${reporte.label} (${carpetaMes}). Archivos encontrados: ${files.length}`);
    
    if (files.length === 0) return;

    let dnisFiltrar = [];
    if (fs.existsSync(ESPECIALIDADES_FILE)) {
        try {
            const esp = JSON.parse(fs.readFileSync(ESPECIALIDADES_FILE, 'utf8'));
            dnisFiltrar = esp.map(p => p.DNI.toString().trim());
        } catch (e) { }
    }

    let totalData = [];
    for (const file of files) {
        const data = parsearArchivo(path.join(dir, file));
        console.log(`   - Leído: ${file} (${data.length} registros)`);
        
        if (reporte.id === 'horas') {
            const filtrados = data.filter(row => {
                const dniProf = row['DOC_PROFESIONAL'] || row['DOC_IDENTIDAD_PROFESIONAL'] || '';
                return dnisFiltrar.includes(dniProf.trim());
            });
            totalData = totalData.concat(filtrados);
        } else {
            totalData = totalData.concat(data);
        }
    }

    if (totalData.length > 0) {
        let outName = "";
        let content = "";
        
        console.log(`🚀 Generando archivo consolidado con ${totalData.length} registros totales...`);
        
        const esCSV = ['atendidos_topico', 'perfil_cex', 'perfil_hos', 'perfil_eme', 'atenciones_paciente'].includes(reporte.id);
        if (esCSV) {
            outName = `consolidado_${reporte.id}_${carpetaMes}.csv`;
            const headers = Object.keys(totalData[0]);
            // Usamos un loop para construir el CSV por partes y evitar bloqueos de memoria
            let csvRows = [headers.join(';')];
            for(let i=0; i < totalData.length; i++) {
                csvRows.push(headers.map(h => totalData[i][h]).join(';'));
            }
            content = csvRows.join('\n');
        } else {
            outName = `consolidado_${reporte.id}_${carpetaMes}.json`;
            content = JSON.stringify(totalData, null, 2);
        }

        const outPath = path.join(dir, outName);
        fs.writeFileSync(outPath, content);
        console.log(`✅ CONSOLIDADO GENERADO: ${outPath}`);

        const config = cargarConfigCerete();
        // Para los nuevos reportes (tópicos, perfiles y atenciones) se omite la copia según pedido.
        const esNuevo = ['atendidos_topico', 'perfil_cex', 'perfil_hos', 'perfil_eme', 'atenciones_paciente'].includes(reporte.id);
        if (config.rutaDestino && config.rutaDestino.trim() !== '' && !esNuevo) {
            try {
                let destPath = config.rutaDestino.trim();
                if (!destPath.toLowerCase().endsWith('.json') && !destPath.toLowerCase().endsWith('.csv')) {
                    if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
                    destPath = path.join(destPath, outName);
                } else {
                    const destDir = path.dirname(destPath);
                    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                }
                fs.writeFileSync(destPath, content);
                console.log(`📂 COPIA REALIZADA A: ${destPath}`);
            } catch (e) { }
        }
    } else {
        console.log("⚠ No hay datos suficientes para consolidar.");
    }
}

async function run() {
    console.log("🤖 Robot EsSalud iniciado...");
    const gui = await mostrarMenuGUI();
    while (true) {
        ROBOT_STOP = false;
        const datos = await gui.esperarSiguiente();
        const mes = parseInt(datos.mes);
        const anio = parseInt(datos.anio);
        CREDENCIALES = { usuario: datos.usuario, pass: datos.pass };
        FECHAS = calcularFechas(mes, anio);
        const seleccionadosReportes = REPORTES_CONFIG.filter(r => datos.reps.includes(r.id));
        const seleccionadosCentros = LISTA_CENTROS.filter(c => datos.centros.includes(c.valor));

        // Guardar credenciales para la próxima vez
        const currentConfig = cargarConfigCerete();
        guardarConfigCerete({
            ...currentConfig,
            usuario: datos.usuario,
            pass: datos.pass
        });

        console.log("\n--- NUEVA TAREA RECIBIDA ---");
        const totalT = seleccionadosReportes.length * seleccionadosCentros.length;
        let ciclo = 1;
        do {
            console.log(`\n--- INICIANDO CICLO ${ciclo} ---`);
            let actualT = 0;
            for (const reporte of seleccionadosReportes) {
                for (const centro of seleccionadosCentros) {
                    if (ROBOT_STOP) break;
                    actualT++;
                    const fileName = getNombreArchivo(centro, mes, anio, reporte.formato);
                    await gui.page.evaluate(({ c, f, h, a, t }) => {
                        window.updateStatus(c, f, true, a, t);
                        document.getElementById('statusBar').innerText = `📥 ${a}/${t} - Descargando: ${c}`;
                        if (h) window.hablar("Descargando " + c);
                    }, { c: centro.texto, f: fileName, h: datos.hablar, a: actualT, t: totalT });
                    try {
                        await ejecutarDescarga(centro, reporte, mes, anio, CREDENCIALES, gui);
                    } catch (err) {
                        console.error(`❌ Error en descarga: ${err.message}`);
                        await gui.page.evaluate((msg) => {
                            document.getElementById('statusBar').innerText = "❌ " + msg;
                        }, `Error: ${err.message}`);
                    }
                }
                if (ROBOT_STOP) break;
                await consolidarMes(reporte, mes, anio);
            }
            await gui.page.evaluate(() => window.updateStatus('', '', false));
            if (ROBOT_STOP) break;
            ciclo++;
            if (datos.repetir) await new Promise(r => setTimeout(r, 10000));
        } while (datos.repetir && !ROBOT_STOP);
        await gui.page.evaluate(() => window.terminado());
    }
}

run().catch(err => { console.error("❌ Error fatal:", err); });