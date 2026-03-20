const { chromium } = require('playwright');

(async () => {
    try {
        console.log("Intentando lanzar Edge...");
        const browser = await chromium.launch({ headless: false, channel: 'msedge' });
        console.log("Edge lanzado correctamente!");
        const page = await browser.newPage();
        await page.goto('https://www.google.com');
        console.log("Navegación exitosa!");
        await browser.close();
        console.log("Prueba finalizada con éxito.");
    } catch (err) {
        console.error("Error al lanzar Edge:", err);
    }
})();
