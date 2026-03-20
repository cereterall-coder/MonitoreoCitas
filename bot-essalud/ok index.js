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

// Credenciales por defecto
const CREDENCIALES_DEFAULT = { usuario: '02855470', pass: '02855470Al3' };
const URL_SISTEMA = 'http://appsgasistexpl.essalud.gob.pe/explotaDatos/index.html';
const BASE_DESCARGAS = path.join(__dirname, 'descargas');

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
        label: "HORAS EFECTIVAS",
        carpeta: "HORAS EFECTIVAS",
        menuP: "ADMISI.*CITAS",
        subM: "PROG.*HORAS.*EFECTIVAS",
        formato: "TXT"
    },
    {
        id: "pacientes",
        label: "PACIENTES CITADOS EN CONSULTA EXTERNA",
        carpeta: "PACIENTES CITADOS EN CONSULTA EXTERNA",
        menuP: "ADMISI.*CITAS",
        subM: "PACIENTES.*CITADOS.*CONSULTA.*EXTERNA",
        formato: "TXT"
    },
    {
        id: "cantidad_tipo",
        label: "CANTIDAD X TIPO DE CITAS",
        carpeta: "CANTIDAD X TIPO DE CITAS",
        menuP: "ADMISI.*CITAS",
        subM: "CANTIDAD.*POR.*TIPO.*DE.*CITAS.*Y.*SERVICIO",
        formato: "PDF"
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

const CONFIG_FILE = path.join(__dirname, 'config_cerete.json');

function cargarConfigCerete() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            // Soporte para formato antiguo o nuevo
            if (Array.isArray(data)) return { centros: data, rutaDestino: '' };
            return {
                centros: data.centros || [],
                rutaDestino: data.rutaDestino || ''
            };
        }
        catch (e) { return { centros: [], rutaDestino: '' }; }
    }
    return { centros: [], rutaDestino: '' };
}

function guardarConfigCerete(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const ESPECIALIDADES_FILE = path.join(__dirname, 'especialidades.json');

let ROBOT_STOP = false;

async function mostrarMenuGUI() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    // Altura segura para cualquier resolución de laptop
    await page.setViewportSize({ width: 1150, height: 620 });

    const now = new Date();
    const mesActual = now.getMonth();
    const anioActual = now.getFullYear();
    let configCerete = cargarConfigCerete();
    let centrosCerete = configCerete.centros;
    let rutaDestino = configCerete.rutaDestino;

    const htmlContent = `
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #00f2fe; --secondary: #4facfe; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #38bdf8;
            }
            html, body { 
                height: 100%; margin: 0; background: var(--bg); color: var(--text); 
                font-family: 'Outfit', sans-serif; overflow: hidden;
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
            .btn-exit {
                background: #ef4444; border: none; color: white;
                padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
                margin-left: 8px; font-weight: 600;
            }

            /* Contenedor que maneja el espacio restante */
            .content-wrapper {
                flex: 1; display: flex; flex-direction: column; min-height: 0; gap: 10px;
            }

            .card-top {
                background: var(--card); border-radius: 10px; padding: 8px;
                border: 1px solid #334155; flex-shrink: 0;
            }

            .main-container { 
                display: grid; grid-template-columns: 280px 1fr; gap: 10px; flex: 1; min-height: 0; 
            }

            .card {
                background: var(--card); border-radius: 10px; padding: 10px;
                border: 1px solid #334155; display: flex; flex-direction: column; min-height: 0;
            }
            .card h3 { margin: 0 0 6px; font-size: 12px; color: var(--accent); text-transform: uppercase; }

            .scroll-area { 
                flex: 1; overflow-y: auto; padding-right: 5px; 
                scrollbar-width: thin; scrollbar-color: #475569 transparent;
            }
            .scroll-area::-webkit-scrollbar { width: 4px; }
            .scroll-area::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }

            .centers-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }

            .row-period, .row-creds { display: flex; gap: 8px; align-items: center; }
            .row-creds { margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
            .input-group { flex: 1; }
            label { display: block; font-size: 10px; color: #94a3b8; }
            select, input[type="number"], input[type="text"], input[type="password"] {
                width: 100%; background: #0f172a; border: 1px solid #334155;
                color: white; padding: 5px; border-radius: 6px; font-family: inherit; font-size: 12px;
            }

            .item {
                display: flex; align-items: center; gap: 6px; padding: 4px 6px;
                border-radius: 6px; transition: background 0.2s; cursor: pointer;
            }
            .item:hover { background: #334155; }
            .item input[type="checkbox"] { width: 14px; height: 14px; accent-color: var(--primary); }
            .item label { margin: 0; color: var(--text); font-size: 11px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .btn-all, .btn-cerete {
                background: transparent; border: 1px solid var(--accent); color: var(--accent);
                padding: 3px 8px; border-radius: 6px; cursor: pointer; font-size: 10px; margin-left: 4px;
            }
            .btn-cerete { border-color: #fbbf24; color: #fbbf24; }

            .btn-start { flex: 1; background: linear-gradient(135deg, var(--primary), var(--secondary)); border: none; color: #0f172a; font-weight: 700; font-size: 13px; padding: 10px; border-radius: 8px; cursor: pointer; }
            .btn-stop { background: #ef4444; color: white; border: none; font-weight: 700; font-size: 13px; padding: 10px; border-radius: 8px; cursor: pointer; display: none; margin-left:10px;}
            
            #loopOption { display: none; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.1); padding: 5px 10px; border-radius: 6px; border: 1px dashed var(--accent); margin-right: 10px; }
            #loopOption label { color: var(--accent); font-weight: 600; font-size: 11px; cursor: pointer; }

            .status-bar { font-size: 11px; color: #94a3b8; margin-top: 5px; text-align: center; }

            #modalConfig { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; padding: 20px; display: none; align-items: center; justify-content: center; }
            .modal-content { background: var(--card); border-radius: 12px; width: 95%; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column; padding: 15px; border: 1px solid var(--accent); }

            /* Confirmacion personalizada */
            #confirmExit { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200; display: none; align-items: center; justify-content: center; }
            .confirm-card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid var(--accent); text-align: center; max-width: 300px; }
            .confirm-btns { display: flex; gap: 10px; margin-top: 15px; }
        </style>
    </head>
    <body onclick="if(event.target.id==='modalConfig') cerrarConfig()">
        <div class="header">
            <h1>Panel de Control Robot</h1>
            <div>
                <button class="btn-config" onclick="abrirConfig()">⚙️ Configurar CERETE</button>
                <button class="btn-exit" onclick="mostrarConfirmSalir()">❌ Salir</button>
            </div>
        </div>

        <!-- Confirmacion personalizada de Salida -->
        <div id="confirmExit">
            <div class="confirm-card">
                <h3 style="margin-top:0;">¿Cerrar el Robot?</h3>
                <p style="font-size:12px; color:#94a3b8;">Se interrumpirá cualquier proceso activo.</p>
                <div class="confirm-btns">
                    <button class="btn-start" style="background:#ef4444; color:white;" onclick="window.salir()">SÍ, SALIR</button>
                    <button class="btn-all" onclick="ocultarConfirmSalir()">CANCELAR</button>
                </div>
            </div>
        </div>

        <div class="content-wrapper">
            <div class="card-top" style="display: flex; flex-direction: column; gap: 5px;">
                <div class="row-creds">
                    <div class="input-group">
                        <label>Usuario EsSalud</label>
                        <input type="text" id="user" value="${CREDENCIALES_DEFAULT.usuario}" placeholder="Usuario" />
                    </div>
                    <div class="input-group">
                        <label>Contraseña</label>
                        <input type="password" id="pass" value="${CREDENCIALES_DEFAULT.pass}" placeholder="Contraseña" />
                    </div>
                    <div style="flex: 2;"></div>
                </div>

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
                        <label for="repetirBucle">REPETIR BUCLE (Horas Efectivas)</label>
                    </div>

                    <div style="flex: 2; align-self: flex-end; display:flex;">
                        <button id="btnStart" class="btn-start" onclick="start()">INICIAR PROCESO DE DESCARGA</button>
                        <button id="btnStop" class="btn-stop" onclick="stopRobot()">DETENER ROBOT</button>
                    </div>
                </div>
                <div id="statusBar" class="status-bar">Esperando selección...</div>
            </div>

            <div class="main-container">
                <div class="card">
                    <h3>Reportes</h3>
                    <div class="scroll-area">
                        ${REPORTES_CONFIG.map(r => `
                            <div class="item" onclick="handleRepClick('${r.id}')">
                                <input type="checkbox" id="rep_${r.id}" value="${r.id}" class="rep" onclick="event.stopPropagation(); handleRepClick('${r.id}')">
                                <label title="${r.label}">${r.label}</label>
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

        <script>
            let LISTA_CERETE = ${JSON.stringify(centrosCerete)};
            let RUTA_DESTINO = "${rutaDestino.replace(/\\/g, '\\\\')}";

            function toggleCheck(id) {
                const cb = document.getElementById(id);
                if(cb) cb.checked = !cb.checked;
            }

            function handleRepClick(id) {
                if(id !== 'horas') {
                    const cb = document.getElementById('rep_' + id);
                    if(event.target && event.target.type !== 'checkbox') cb.checked = !cb.checked;
                }
                actualizarBucle();
            }

            function actualizarBucle() {
                const cbHoras = document.getElementById('rep_horas');
                const horasChecked = cbHoras ? cbHoras.checked : false;
                document.getElementById('loopOption').style.display = horasChecked ? 'flex' : 'none';
                if(!horasChecked) document.getElementById('repetirBucle').checked = false;
            }

            function abrirConfig() { document.getElementById('modalConfig').style.display = 'flex'; }
            function cerrarConfig() { document.getElementById('modalConfig').style.display = 'none'; }

            function seleccionarCerete() { document.querySelectorAll('.centro').forEach(c => c.checked = LISTA_CERETE.includes(c.value)); }
            function seleccionarTodos() { document.querySelectorAll('.centro').forEach(c => c.checked = true); }
            function limpiarTodos() { document.querySelectorAll('.centro').forEach(c => c.checked = false); }

            async function guardarConfig() {
                const seleccionados = Array.from(document.querySelectorAll('.cfg-centro:checked')).map(c => c.value);
                const ruta = document.getElementById('cfg_rutaDestino').value;
                await window.saveCerete({ centros: seleccionados, rutaDestino: ruta });
                LISTA_CERETE = seleccionados;
                RUTA_DESTINO = ruta;
                alert("✅ Configuración guardada correctamente");
                cerrarConfig();
            }

            function stopRobot() {
                window.detener();
                document.getElementById('statusBar').innerText = "🛑 Deteniendo al terminar descarga actual...";
                document.getElementById('btnStop').disabled = true;
                document.getElementById('btnStop').innerText = "DETENIENDO...";
            }

            function start(){
                const user = document.getElementById('user').value;
                const pass = document.getElementById('pass').value;
                const mes = document.getElementById('mes').value;
                const anio = document.getElementById('anio').value;
                const reps = Array.from(document.querySelectorAll('.rep:checked')).map(r=>r.value);
                const centros = Array.from(document.querySelectorAll('.centro:checked')).map(c=>c.value);
                const repetir = document.getElementById('repetirBucle').checked;

                if(!user || !pass) return alert("⚠️ Ingresa las credenciales");
                if(reps.length===0) return alert("⚠️ Selecciona un reporte");
                if(centros.length===0) return alert("⚠️ Selecciona un centro");

                document.getElementById('btnStart').disabled = true;
                document.querySelectorAll('input, select, button').forEach(el => {
                    if(el.id !== 'btnStop') el.disabled = true;
                });
                document.getElementById('btnStop').style.display = 'block';
                document.getElementById('statusBar').innerText = "🚀 Robot en ejecución...";

                window.enviar({user, pass, mes, anio, reps, centros, repetir});
            }

            function mostrarConfirmSalir() { document.getElementById('confirmExit').style.display = 'flex'; }
            function ocultarConfirmSalir() { document.getElementById('confirmExit').style.display = 'none'; }

            window.terminado = () => {
                document.getElementById('btnStart').disabled = false;
                document.getElementById('btnStop').style.display = 'none';
                document.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
                document.getElementById('statusBar').innerText = "✅ Proceso finalizado.";
                actualizarBucle();
            };
        </script>
    </body>
    </html>
    `;

    return new Promise(async (resolve) => {
        // Exponer funciones ANTES de cargar el contenido para asegurar disponibilidad
        await page.exposeFunction('saveCerete', (config) => guardarConfigCerete(config));
        await page.exposeFunction('detener', () => { ROBOT_STOP = true; });
        await page.exposeFunction('salir', () => {
            console.log("Cerrando el sistema por solicitud del usuario...");
            process.exit(0);
        });
        await page.exposeFunction('enviar', (data) => {
            resolve({ datos: data, page, browser });
        });

        await page.setContent(htmlContent);
    });
}

async function ejecutarDescarga(centro, reporte, mes, anio, creds) {

    const mesPad = (mes + 1).toString().padStart(2, '0');
    const carpetaMes = `${anio}-${mesPad}`;
    const carpetaFinal = path.join(BASE_DESCARGAS, reporte.carpeta, carpetaMes);

    if (!fs.existsSync(carpetaFinal)) fs.mkdirSync(carpetaFinal, { recursive: true });

    const fileName = getNombreArchivo(centro, mes, anio, reporte.formato);
    const dest = path.join(carpetaFinal, fileName);

    if (fs.existsSync(dest)) {
        console.log(`[EXISTE] ${fileName} - Reemplazando en ${carpetaMes}...`);
        // No retornamos, permitimos que siga para descargar y sobrescribir
    }

    console.log(`\n>>> ${reporte.label}: ${centro.texto}`);

    const browser = await chromium.launch({ headless: false, slowMo: 600 });
    const page = await browser.newPage();

    try {
        await page.goto(URL_SISTEMA, { waitUntil: 'load', timeout: 60000 });

        const findFrameBySelector = async (selector) => {
            for (let i = 0; i < 20; i++) {
                for (const f of page.frames()) {
                    if (await f.locator(selector).isVisible().catch(() => false)) return f;
                }
                await page.waitForTimeout(2000);
            }
            return null;
        };

        let fLogin = await findFrameBySelector('input[name="USER"]');
        if (!fLogin) throw new Error('Login no encontrado');

        await fLogin.locator('input[name="USER"]').fill(creds.usuario);
        await fLogin.locator('input[name="PASS"]').fill(creds.pass);
        await fLogin.locator('input[value*="Ingresar"]').click();

        let fSelect = await findFrameBySelector('select');
        if (!fSelect) throw new Error('Selector centro no encontrado');

        await fSelect.locator('select').selectOption(centro.valor);
        await page.waitForTimeout(1000);
        await fSelect.locator('input[value*="Ingresar"]').click();
        await page.waitForTimeout(15000);

        const findAndClick = async (pattern) => {
            for (let i = 0; i < 15; i++) {
                for (const fr of page.frames()) {
                    const el = fr.locator(`text=/${pattern}/i`).first();
                    if (await el.isVisible().catch(() => false)) {
                        await el.click();
                        return fr;
                    }
                }
                await page.waitForTimeout(2000);
            }
            return null;
        };

        if (!await findAndClick(reporte.menuP))
            throw new Error('Menu principal no encontrado');

        await page.waitForTimeout(5000);

        if (!await findAndClick(reporte.subM))
            throw new Error('Submenu no encontrado');

        await page.waitForTimeout(10000);

        let fRep = null;
        for (let i = 0; i < 10; i++) {
            for (const fr of page.frames()) {
                const count = await fr.evaluate(() =>
                    document.querySelectorAll('input[type="text"]').length
                ).catch(() => 0);

                if (count >= 2) { fRep = fr; break; }
            }
            if (fRep) break;
            await page.waitForTimeout(2000);
        }

        if (!fRep) throw new Error('Formulario no encontrado');

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

        await page.waitForTimeout(2000);

        const selects = await fRep.$$('select');
        for (const s of selects) {
            const opts = await s.$$eval('option', os => os.map(o => o.innerText.trim()));
            let idx = -1;

            if (reporte.formato === 'PDF') {
                idx = opts.findIndex(t => t.includes('*.PDF'));
            } else {
                idx = opts.findIndex(t => t.includes('*.TXT') && t.includes('XLS'));
            }

            if (idx !== -1) {
                await s.selectOption({ index: idx });
                break;
            }
        }

        await page.waitForTimeout(2000);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 60000 }).catch(() => null),
            fRep.locator('input[value*="Imprimir" i], input[type="submit"]').first().click()
        ]);

        if (download) {
            await download.saveAs(dest);
            console.log(`✅ DESCARGADO`);
        } else {
            console.log('❌ No se generó descarga');
        }

    } catch (e) {
        console.log(`⚠ ERROR: ${e.message}`);
    } finally {
        await browser.close().catch(() => { });
    }
}

function parsearArchivo(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];

        // Detectar separador (EsSalud usa Pipe | o Tabulador \t)
        const firstLine = lines[0];
        const sep = firstLine.includes('|') ? '|' : '\t';

        const header = firstLine.split(sep).map(h => h.trim().replace(/"/g, ''));
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''));
            const obj = {};
            header.forEach((h, idx) => {
                obj[h] = cols[idx] || '';
            });
            results.push(obj);
        }
        return results;
    } catch (e) {
        console.log(`Error parseando ${path.basename(filePath)}: ${e.message}`);
        return [];
    }
}

async function consolidarMes(reporte, mes, anio) {
    if (reporte.id !== 'horas') return; // Solo consolidamos Horas Efectivas
    if (reporte.formato !== 'TXT') return;

    const mesPad = (mes + 1).toString().padStart(2, '0');
    const carpetaMes = `${anio}-${mesPad}`;
    const dir = path.join(BASE_DESCARGAS, reporte.carpeta, carpetaMes);

    if (!fs.existsSync(dir)) return;

    console.log(`\n📦 Consolidando: ${reporte.label} (${carpetaMes})...`);

    let dnisFiltrar = [];
    if (fs.existsSync(ESPECIALIDADES_FILE)) {
        try {
            const esp = JSON.parse(fs.readFileSync(ESPECIALIDADES_FILE, 'utf8'));
            dnisFiltrar = esp.map(p => p.DNI.toString().trim());
        } catch (e) {
            console.log("Error leyendo especialidades.json:", e.message);
        }
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.includes('consolidado'));
    let totalData = [];

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const data = parsearArchivo(fullPath);

        const filtrados = data.filter(row => {
            const dniProf = row['DOC_PROFESIONAL'] || row['DOC_IDENTIDAD_PROFESIONAL'] || '';
            return dnisFiltrar.includes(dniProf.trim());
        });

        totalData = totalData.concat(filtrados);
    }

    if (totalData.length > 0) {
        const outName = `consolidado_${reporte.id}_${carpetaMes}.json`;
        const outPath = path.join(dir, outName);
        fs.writeFileSync(outPath, JSON.stringify(totalData, null, 2));
        console.log(`✅ CONSOLIDADO GENERADO: ${totalData.length} registros en ${path.basename(outPath)}`);

        // Copiar a ruta de destino si existe configurada
        const config = cargarConfigCerete();
        if (config.rutaDestino && config.rutaDestino.trim() !== '') {
            try {
                // Si la ruta destino termina en .json, la usamos tal cual; si no, añadimos el nombre del archivo
                let destPath = config.rutaDestino.trim();
                if (!destPath.toLowerCase().endsWith('.json')) {
                    if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
                    destPath = path.join(destPath, outName);
                } else {
                    const destDir = path.dirname(destPath);
                    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                }

                fs.copyFileSync(outPath, destPath);
                console.log(`📂 COPIA REALIZADA A: ${destPath}`);
            } catch (e) {
                console.log(`⚠ No se pudo copiar a la ruta de destino: ${e.message}`);
            }
        }
    } else {
        console.log("⚠ No se encontraron registros que coincidan con los especialistas.");
    }
}

async function run() {
    ROBOT_STOP = false;
    const ctx = await mostrarMenuGUI();
    if (!ctx) return;
    const { datos, page } = ctx;

    const mes = parseInt(datos.mes);
    const anio = parseInt(datos.anio);
    FECHAS = calcularFechas(mes, anio);

    const seleccionadosReportes = REPORTES_CONFIG.filter(r => datos.reps.includes(r.id));
    const seleccionadosCentros = LISTA_CENTROS.filter(c => datos.centros.includes(c.valor));

    console.log("Rango:", FECHAS);
    if (datos.repetir) console.log("♻️ MODO BUCLE ACTIVADO");

    let ciclo = 1;
    do {
        console.log(`\n--- INICIANDO CICLO ${ciclo} ---`);
        for (const reporte of seleccionadosReportes) {
            for (const centro of seleccionadosCentros) {
                if (ROBOT_STOP) break;
                await ejecutarDescarga(centro, reporte, mes, anio, { usuario: datos.user, pass: datos.pass });
            }
            if (ROBOT_STOP) break;

            // Al terminar todos los centros de un reporte, consolidamos
            await consolidarMes(reporte, mes, anio);
        }
        if (ROBOT_STOP) {
            console.log("🛑 DETENCIÓN SOLICITADA");
            break;
        }
        ciclo++;
        if (datos.repetir) {
            console.log("\n⏳ Esperando 10 segundos antes de reiniciar el bucle...");
            await new Promise(r => setTimeout(r, 10000));
        }
    } while (datos.repetir && !ROBOT_STOP);

    await page.evaluate(() => window.terminado());
    console.log("✅ ROBOT FINALIZADO");
}

run();