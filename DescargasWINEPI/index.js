const path = require('path');
const fs = require('fs');

const { chromium } = require('playwright');

/**
 * ROBOT WINEPI - DESCARGA AUTOMATIZADA v3.9 (Iron Survival)
 */

const URL_BASE = 'http://172.20.0.67:8080/descargaWinEpi/';
const CENTERS_DB = JSON.parse(fs.readFileSync(path.join(__dirname, 'centers.json'), 'utf8'));

let ROBOT_STOP = false;

async function startGUI() {
    console.log("🚀 Iniciando Interfaz v3.9 (Descarga Masiva)...");
    
    let browser;
    try {
        browser = await chromium.launch({ headless: false, channel: 'msedge', args: ['--no-sandbox', '--disable-gpu'] });
    } catch (err) {
        browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-gpu'] });
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 600 });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>WinEpi Robot v3.9</title>
        <style>
            :root {
                --bg: #050508;
                --card: rgba(255, 255, 255, 0.04);
                --accent: #00f2fe;
                --text: #e0e0e0;
                --danger: #ef4444;
                --success: #22c55e;
                --warning: #facc15;
            }
            * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; font-size: 14px; }
            body { background: #050508; color: var(--text); margin: 0; padding: 10px; height: 100vh; overflow: hidden; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 5px 15px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
            h1 { margin: 0; font-size: 1.15rem; color: var(--accent); text-transform: uppercase; font-weight: 900; }
            .main-grid { display: grid; grid-template-columns: 340px 1fr; gap: 12px; height: calc(100vh - 75px); }
            .panel { background: var(--card); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; min-height: 0; backdrop-filter: blur(10px); }
            .section-title { font-size: 0.75rem; color: var(--accent); font-weight: 800; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 3px; }
            input { width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; padding: 5px 10px; outline: none; margin-bottom: 8px; }
            .rep-btn { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 7px 10px; border-radius: 6px; margin-bottom: 5px; cursor: pointer; font-size: 0.8rem; }
            .rep-btn.active { border-color: var(--accent); background: rgba(0,242,254,0.1); color: var(--accent); font-weight: bold; }
            .scroll { flex: 1; overflow-y: auto; padding-right: 5px; }
            .center-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px; }
            .center-item { font-size: 0.72rem; padding: 5px 8px; border-radius: 4px; background: rgba(255,255,255,0.01); border: 1px solid transparent; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .center-item.active { border-color: var(--accent); background: rgba(0,242,254,0.05); color: var(--accent); font-weight: bold; }
            .weeks-grid { display: grid; grid-template-columns: repeat(26, 1fr); gap: 2px; margin-bottom: 12px; }
            .week-box { background: rgba(255,255,255,0.02); font-size: 0.65rem; padding: 4px 0; text-align: center; border-radius: 3px; cursor: pointer; }
            .week-box.active { background: var(--accent); color: #000; font-weight: bold; }
            .btn-go { background: linear-gradient(45deg, #00f2fe, #4facfe); color: #000; border: none; padding: 15px; border-radius: 10px; font-weight: 900; width: 100%; cursor: pointer; }
            .btn-stop { background: var(--danger); color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 900; width: 100%; cursor: pointer; display: none; }
            .active-monitor { margin: 10px 0; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 12px; padding: 12px; display: none; flex-direction: column; }
            .log-compact { background: rgba(0,0,0,0.4); border-radius: 8px; padding: 8px; font-family: monospace; font-size: 0.6rem; color: #777; height: 120px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.02); margin-top: 10px; }
            .author-card { position: fixed; bottom: 12px; right: 15px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 8px 12px; backdrop-filter: blur(8px); font-size: 0.62rem; color: #999; text-align: right; line-height: 1.4; pointer-events: none; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
            .author-name { color: var(--accent); font-weight: 800; font-size: 0.68rem; text-transform: uppercase; display: block; margin-bottom: 1px; }
            
            /* Login Overlay */
            #login-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #050508; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .login-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); padding: 30px; border-radius: 20px; text-align: center; backdrop-filter: blur(20px); width: 320px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
            .login-box h2 { color: var(--accent); margin-top: 0; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 2px; }
            .login-box input { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 12px; width: 100%; text-align: center; font-size: 1rem; margin-bottom: 15px; outline: none; }
            .login-box button { background: linear-gradient(45deg, #00f2fe, #4facfe); color: #000; border: none; padding: 12px; width: 100%; border-radius: 8px; font-weight: 900; cursor: pointer; }
        </style>
    </head>
    <body onload="init()">
        <div id="login-overlay">
            <div class="login-box">
                <h2>ACCESO ROBOT</h2>
                <p style="font-size:0.7rem; color:#666; margin-bottom:20px;">Ingrese la clave de sistema para continuar</p>
                <input type="password" id="login-input" placeholder="••••••••" onkeypress="if(event.key==='Enter') doLogin()">
                <button onclick="doLogin()">PROCESAR INGRESO</button>
            </div>
        </div>

        <div class="header">
            <div><h1>WinEpi v3.9 <span style="font-weight:200; opacity:0.4">| Descarga Masiva</span></h1></div>
            <div id="status-tag" style="color:var(--accent); font-weight:bold;">ESTADO: LISTO</div>
        </div>
        <div class="main-grid">
            <div class="panel">
                <div class="section-title">Credenciales</div>
                <input type="text" id="user" value="winepi">
                <input type="password" id="pass" value="winepi">
                <div class="section-title">Reportes</div>
                <div class="rep-grid">
                    <div class="rep-btn" id="rep_1" onclick="toggleReport(1)">📄 Consulta Externa</div>
                    <div class="rep-btn" id="rep_2" onclick="toggleReport(2)">🏨 Hospitalización</div>
                    <div class="rep-btn" id="rep_3" onclick="toggleReport(3)">🚨 Emergencia</div>
                </div>
                <div class="active-monitor" id="monitor">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span id="m-count" style="background:var(--accent); color:black; font-weight:900; padding:2px 8px; border-radius:5px;">0/0</span>
                        <span id="s-timer" style="color:var(--success); font-weight:bold;">--- s</span>
                    </div>
                    <span id="m-name" class="monitor-name">Esperando...</span>
                    <span id="m-report" style="color:var(--accent); font-weight:bold; font-size:0.7rem;">---</span>
                </div>
                <div style="flex:1"></div>
                <button class="btn-go" id="btnStart" onclick="doStart()">🚀 Iniciar Descarga de Archivos</button>
                <button class="btn-stop" id="btnStop" onclick="doStop()">🛑 DETENER</button>
                <div class="log-compact" id="log">Monitor de sistema v3.9</div>
            </div>
            <div class="panel">
                <div class="section-title">Semanas</div>
                <div class="weeks-grid" id="weeks-grid"></div>
                <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Establecimientos</span>
                    <div style="display:flex; gap:8px;">
                        <span onclick="selectAllCenters()" style="cursor:pointer; color:var(--accent); font-size:0.6rem; letter-spacing:0.5px;">✓ TODO</span>
                        <span onclick="clearAllCenters()" style="cursor:pointer; color:var(--danger); font-size:0.6rem; letter-spacing:0.5px;">✖ BORRAR</span>
                    </div>
                </div>
                <div class="scroll"><div class="center-grid" id="centers-list"></div></div>
            </div>
        </div>
        
        <div class="author-card">
            <span class="author-name">Amaro Alexisy Vilela Vargas</span>
            Ing. de sistemas - OSI R.A. La Libertad<br>
            amalviva@gmail.com - 944499069
        </div>

        <script>
            let selectedCenters = [];
            let selectedWeeks = [1];
            let activeReports = [];
            const CENTERS = ${JSON.stringify(CENTERS_DB)};
            const EH_CENTERS = ['429', '207', '211', '212', '213', '208', '241', '206', '205', '671', '210', '209', '444'];

            function init() {
                const grid = document.getElementById('weeks-grid');
                for(let i=1; i<=53; i++) {
                    const b = document.createElement('div');
                    b.className = 'week-box' + (i===1 ? ' active' : ''); b.innerText = i; b.id = 'w_' + i;
                    grid.appendChild(b);
                    b.onclick = () => {
                        const isSelected = selectedWeeks.includes(i);
                        
                        // Limpiar todos visualmente
                        document.querySelectorAll('.week-box').forEach(wb => wb.classList.remove('active'));
                        
                        if(isSelected) {
                            selectedWeeks = [];
                        } else {
                            selectedWeeks = [i];
                            b.classList.add('active');
                        }
                    };
                }
                renderCenters();
            }

            function selectAllCenters() {
                const filtered = (activeReports.includes(2) || activeReports.includes(3)) 
                    ? CENTERS.filter(c => EH_CENTERS.includes(c.valor))
                    : CENTERS;
                
                selectedCenters = filtered.map(c => c.valor);
                renderCenters();
            }

            function clearAllCenters() {
                selectedCenters = [];
                renderCenters();
            }

            function renderCenters() {
                const cl = document.getElementById('centers-list');
                cl.innerHTML = '';
                
                // Si hay reportes tipo 2 o 3 activos, filtramos
                const filtered = (activeReports.includes(2) || activeReports.includes(3)) 
                    ? CENTERS.filter(c => EH_CENTERS.includes(c.valor))
                    : CENTERS;

                filtered.forEach(c => {
                    const d = document.createElement('div');
                    const isActive = selectedCenters.includes(c.valor);
                    d.className = 'center-item' + (isActive ? ' active' : '');
                    d.innerText = c.nombre; d.id = 'c_' + c.valor;
                    cl.appendChild(d);
                    d.onclick = () => {
                        const idx = selectedCenters.indexOf(c.valor);
                        if(idx > -1) { selectedCenters.splice(idx,1); d.classList.remove('active'); }
                        else { selectedCenters.push(c.valor); d.classList.add('active'); }
                    };
                });

                // Limpiar centros seleccionados que ya no están visibles para evitar errores
                const visibleIds = filtered.map(x => x.valor);
                selectedCenters = selectedCenters.filter(id => visibleIds.includes(id));
            }

            function toggleReport(r) {
                const isSelected = activeReports.includes(r);
                
                // Limpiar todas las clases active de los botones de reportes
                [1, 2, 3].forEach(id => {
                    const el = document.getElementById('rep_' + id);
                    if (el) el.classList.remove('active');
                });

                if (isSelected) {
                    activeReports = [];
                } else {
                    activeReports = [r];
                    document.getElementById('rep_' + r).classList.add('active');
                }
                
                renderCenters();
            }
            function doStart() {
                if(selectedCenters.length === 0 || activeReports.length === 0) { alert('Selecciona opciones'); return; }
                document.getElementById('monitor').style.display = 'flex';
                document.getElementById('btnStart').style.display = 'none';
                document.getElementById('btnStop').style.display = 'block';
                document.getElementById('status-tag').innerText = 'ESTADO: PROCESANDO';
                window.onStart({
                    creds: { user: document.getElementById('user').value, pass: document.getElementById('pass').value },
                    weeks: selectedWeeks.sort((a,b)=>a-b),
                    reports: activeReports.sort((a,b)=>a-b),
                    centers: selectedCenters
                });
            }
            function doStop() { window.onStop(); }
            window.updateStats = (done, total, week, name, report, timer) => {
                document.getElementById('m-count').innerText = done + "/" + total;
                document.getElementById('m-name').innerText = name;
                document.getElementById('m-report').innerText = report + " (Semana " + week + ")";
                document.getElementById('s-timer').innerText = (timer || "---") + " s";
            };
            window.onLog = (msg) => {
                const l = document.getElementById('log');
                const s = document.createElement('div');
                s.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg;
                l.prepend(s);
            };
            window.removeCenter = (id) => {
                const idx = selectedCenters.indexOf(id);
                if(idx > -1) { selectedCenters.splice(idx, 1); renderCenters(); }
            };

            window.doLogin = () => {
                const now = new Date();
                const dd = String(now.getDate()).padStart(2, '0');
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const expected = "Essalud" + dd + mm;
                const input = document.getElementById('login-input').value;
                
                if(input === expected) {
                    document.getElementById('login-overlay').style.display = 'none';
                } else {
                    alert('Acceso denegado: Clave incorrecta');
                    document.getElementById('login-input').value = '';
                }
            };
        </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent);

    await page.exposeFunction('onStart', async (config) => {
        ROBOT_STOP = false;
        await runRobot(config, page);
    });

    await page.exposeFunction('onStop', () => { ROBOT_STOP = true; });
}

async function runRobot(config, guiPage) {
    const { creds, weeks, centers, reports } = config;
    const baseDownloadPath = path.join(__dirname, 'descargas');
    if (!fs.existsSync(baseDownloadPath)) fs.mkdirSync(baseDownloadPath);

    const totalTasks = weeks.length * reports.length * centers.length;
    const log = async (m) => { await guiPage.evaluate((msg) => window.onLog(msg), m); console.log(m); };

    const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    let totalDownloaded = 0;
    const reportNames = { 1: "Consulta Externa", 2: "Hospitalización", 3: "Emergencia" };

    const startTime = Date.now();
    const LIMIT_SECONDS = 580;

    const loginAndSetup = async () => {
        await page.goto(URL_BASE);
        const mainFrame = page.frameLocator('frame[name="cuerpo"]');
        
        // Espera inteligente al selector de usuario
        try {
            await mainFrame.locator('#USER').waitFor({ state: 'visible', timeout: 20000 });
        } catch (e) {
            await log("⚠️ No se detectó el formulario de login. Reintentando carga directa...");
            await page.goto(URL_BASE + 'DescargaWinEpi?opt=1');
            await mainFrame.locator('#USER').waitFor({ state: 'visible', timeout: 10000 }).catch(()=>null);
        }

        if (!await mainFrame.locator('#USER').isVisible()) return false;

        await mainFrame.locator('#USER').fill(creds.user);
        await mainFrame.locator('#PASS').fill(creds.pass);
        await mainFrame.locator('input[value="Ingresar"]').click();
        
        // Esperar a que el login procese y aparezca el selector de Red
        await mainFrame.locator('select[name="redAsistencial"]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
        
        if (await mainFrame.locator('select[name="redAsistencial"]').isVisible()) {
            await mainFrame.locator('select[name="redAsistencial"]').selectOption("15");
            // Dar un tiempo breve para que el combo de establecimientos se cargue
            await page.waitForTimeout(1500);
        }
        return true;
    };

    // Manejador de alertas (diálogos) para detectar "Sin datos" instantáneamente
    let lastAlertMsg = "";
    page.on('dialog', async dialog => {
        lastAlertMsg = dialog.message();
        await dialog.dismiss();
    });

    try {
        if (!await loginAndSetup()) throw new Error("Error de inicio de sesión o tiempo agotado.");

        for (let w of weeks) {
            const weekPath = path.join(baseDownloadPath, `Semana_${w}`);
            if (!fs.existsSync(weekPath)) fs.mkdirSync(weekPath);

            for (let r of reports) {
                for (let c of centers) {
                    if (ROBOT_STOP) break;

                    const elapsedMs = Date.now() - startTime;
                    if (elapsedMs >= LIMIT_SECONDS * 1000) {
                        await log(`🛑 LÍMITE ALCANZADO: Se cumplieron los ${LIMIT_SECONDS} segundos. Deteniendo sesión...`);
                        ROBOT_STOP = true;
                        break;
                    }

                    const centerObj = CENTERS_DB.find(x => x.valor === c);
                    const centerName = centerObj ? centerObj.nombre : c;
                    const reportName = reportNames[r] || "R" + r;

                    let success = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        if (ROBOT_STOP) break;
                        lastAlertMsg = ""; // Reset alerta
                        
                        // MONITOR UPDATE
                        let timeLeft = "---";
                        for(const fr of page.frames()) {
                            const body = await fr.innerText('body').catch(()=>"");
                            const m = body.match(/Falta\s+(\d+)\s+seg/);
                            if(m) { timeLeft = m[1]; break; }
                        }
                        await guiPage.evaluate(([done, total, week, name, rep, time]) => window.updateStats(done, total, week, name, rep, time), [totalDownloaded, totalTasks, w, centerName, reportName, timeLeft]);

                        try {
                            const mainFrame = page.frameLocator('frame[name="cuerpo"]');
                            const centerSelector = mainFrame.locator('select[name="centroAsistencial"]');

                            if (!await centerSelector.isVisible({ timeout: 5000 })) {
                                await log(`Refrescando formulario para ${centerName}...`);
                                await page.goto(URL_BASE + 'DescargaWinEpi?opt=1');
                                await mainFrame.locator('select[name="redAsistencial"]').waitFor({ state: 'visible', timeout: 5000 }).catch(()=>null);
                                await mainFrame.locator('select[name="redAsistencial"]').selectOption("15").catch(()=>null);
                                await page.waitForTimeout(1000);
                            }

                            await log(`[${attempt}/3] Seleccionando: ${centerName}...`);
                            
                            // Selección con pausas breves para estabilidad (formularios dinámicos)
                            await centerSelector.selectOption(c);
                            await page.waitForTimeout(500); 
                            await mainFrame.locator('select[name="anno"]').selectOption("2026");
                            await page.waitForTimeout(300);
                            await mainFrame.locator('select[name="tiporeporte"]').selectOption(String(r));
                            await page.waitForTimeout(300);
                            await mainFrame.locator('select[name="semana"]').selectOption(String(w));
                            await page.waitForTimeout(300);

                            const genBtn = mainFrame.locator('input[value="Generar archivo"]');
                            
                            // 90 segundos de espera para la descarga (algunos centros grandes tardan mucho en procesar)
                            const downloadPromise = page.waitForEvent('download', { timeout: 90000 }).catch(async (e) => {
                                // Si hay un mensaje de alerta nativo, lo capturamos
                                if (lastAlertMsg) throw new Error("ALERTA: " + lastAlertMsg);
                                
                                // Si no hay alerta nativa, revisamos si hay mensajes de error en el texto del frame
                                const frameText = await mainFrame.locator('body').innerText().catch(()=>"");
                                if (frameText.includes("No hay datos") || frameText.includes("no existen") || frameText.includes("Sin datos")) {
                                    throw new Error("ALERTA: Sin datos registrados");
                                }
                                if (frameText.includes("Falta ") && frameText.includes("seg")) {
                                    const m = frameText.match(/Falta\s+(\d+)\s+seg/);
                                    throw new Error(`ESPERA: El sistema pide esperar ${m ? m[1] : '?'} segundos adicionales.`);
                                }
                                throw e;
                            });

                            await genBtn.click();
                            
                            const download = await downloadPromise;
                            const finalPath = path.join(weekPath, download.suggestedFilename());
                            await download.saveAs(finalPath);
                            
                            success = true;
                            totalDownloaded++;
                            await log(`✅ Descargado: ${download.suggestedFilename()}`);
                            break; 

                        } catch (e) {
                            if (e.message.includes("ALERTA") || e.message.includes("Sin datos")) {
                                await log(`ℹ️ Sin datos: ${centerName} (Sem ${w})`);
                                success = true; 
                                break; 
                            }
                            if (e.message.includes("ESPERA")) {
                                await log(`⏳ ${e.message}`);
                                await page.waitForTimeout(10000); // Esperar 10s extra antes del reintento
                                continue;
                            }
                            await log(`⚠️ Intento ${attempt} fallido: ${e.message.substring(0, 100)}`);
                            await page.waitForTimeout(3000);
                            
                            if (attempt < 3) await page.goto(URL_BASE + 'DescargaWinEpi?opt=1').catch(()=>null);
                        }
                    }

                    // Después de procesar el centro (éxito o sin datos), desmarcar del panel
                    if (success) {
                        await guiPage.evaluate((id) => window.removeCenter(id), c).catch(()=>null);
                    }
                }
            }
        }
        await log("🚀 Proceso terminado satisfactoriamente.");
    } catch (e) {
        await log("❌ ERROR CRÍTICO: " + e.message);
    } finally {
        await browser.close();
        await guiPage.evaluate(() => {
            document.getElementById('monitor').style.display = 'none';
            document.getElementById('btnStart').style.display = 'block';
            document.getElementById('btnStop').style.display = 'none';
            document.getElementById('status-tag').innerText = 'ESTADO: TERMINADO';
        });
    }
}

startGUI();
