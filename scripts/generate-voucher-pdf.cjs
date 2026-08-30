const fs = require('fs');
const puppeteer = require('puppeteer');

async function main() {
    const [htmlPath, pdfPath] = process.argv.slice(2);

    if (!htmlPath || !pdfPath) {
        throw new Error('HTML input and PDF output paths are required.');
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(fs.readFileSync(htmlPath, 'utf8'), {
            waitUntil: 'load',
            timeout: 30000,
        });
        await Promise.race([
            page.evaluate(() => Promise.all(
                Array.from(document.images)
                    .filter((image) => !image.complete)
                    .map((image) => new Promise((resolve) => {
                        image.addEventListener('load', resolve, { once: true });
                        image.addEventListener('error', resolve, { once: true });
                    })),
            )),
            new Promise((resolve) => setTimeout(resolve, 10000)),
        ]);
        await page.emulateMediaType('print');
        await page.pdf({
            path: pdfPath,
            format: 'A5',
            printBackground: true,
            preferCSSPageSize: true,
        });
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
});
