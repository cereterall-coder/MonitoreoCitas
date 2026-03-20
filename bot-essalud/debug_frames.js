const { chromium } = require('playwright');

async function debug() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {
        await page.goto('http://appsgasistexpl.essalud.gob.pe/explotaDatos/index.html');
        await page.waitForTimeout(10000);
        console.log('Total frames:', page.frames().length);
        for (const [idx, f] of page.frames().entries()) {
            console.log(`Frame ${idx}: name=${f.name()}, url=${f.url()}`);
            const html = await f.content().catch(() => 'no content');
            if (html.includes('USER') || html.includes('PASS') || html.includes('select')) {
                console.log(`  -> Contiene palabras clave!`);
                const selectCount = await f.locator('select').count().catch(() => 0);
                const inputCount = await f.locator('input').count().catch(() => 0);
                console.log(`     selects: ${selectCount}, inputs: ${inputCount}`);
            }
        }
        await page.screenshot({ path: 'debug_frames.png', fullPage: true });
    } finally {
        await browser.close();
    }
}
debug();
