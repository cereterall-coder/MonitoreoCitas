const { chromium } = require('playwright');

async function testLoginFlow() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    try {
        console.log('Navegando a la página de login...');
        await page.goto('http://appsgasistexpl.essalud.gob.pe/explotaDatos/index.html');
        await page.waitForTimeout(5000);

        let f = page.frames().find(f => f.name() === 'cuerpo' || f.url().includes('index1.html'));
        if (!f) f = page.frames()[1];

        console.log('Tomando screenshot inicial...');
        await page.screenshot({ path: 'flow_1_inicio.png' });

        console.log('Llenando usuario y password...');
        await f.locator('input[name="USER"]').fill('02855470');
        await f.locator('input[name="PASS"]').fill('02855470Al3');
        await page.screenshot({ path: 'flow_2_llenado.png' });

        console.log('Pulsando Ingresar...');
        await f.locator('input[value*="Ingresar"]').click();

        await page.waitForTimeout(10000);
        console.log('URL actual tras login:', page.url());
        await page.screenshot({ path: 'flow_3_tras_login.png' });

        // Listar frames de la nueva página
        console.log('Frames tras login:', page.frames().length);
        for (const [idx, fr] of page.frames().entries()) {
            console.log(`Frame ${idx}: ${fr.name()} - ${fr.url()}`);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}
testLoginFlow();
