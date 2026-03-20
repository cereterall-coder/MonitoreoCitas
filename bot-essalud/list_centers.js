const { chromium } = require('playwright');

async function listCenters() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {
        await page.goto('http://appsgasistexpl.essalud.gob.pe/explotaDatos/index.html');
        await page.waitForTimeout(5000);

        let f = page.frames().find(f => f.name() === 'cuerpo' || f.url().includes('index1.html'));
        await f.locator('input[name="USER"]').fill('02855470');
        await f.locator('input[name="PASS"]').fill('02855470Al3');
        await page.keyboard.press('Enter');

        console.log('Esperando selector...');
        await page.waitForTimeout(8000);

        f = page.frames().find(f => f.url().includes('.jsp'));
        if (!f) f = page.frames().find(f => f.name() === 'cuerpo');

        const options = await f.$$eval('select option', os =>
            os.map(o => ({ texto: o.innerText.trim(), valor: o.value }))
        );
        console.log('CENTROS ENCONTRADOS:', JSON.stringify(options, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}
listCenters();
