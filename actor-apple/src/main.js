import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlaywrightCrawler } from 'crawlee';

// Reconstruir __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta hacia queries.json (una carpeta antes de src)
const QUERIES_PATH = path.resolve(__dirname, '../queries.json');

// Leer el archivo JSON
const rawData = fs.readFileSync(QUERIES_PATH, 'utf8');
const queries = JSON.parse(rawData);

console.log(`📦 ${queries.length} productos cargados desde queries.json`);

const OUTPUT_DIR = path.resolve('output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

async function start() {
  const SESSION_FILE = 'amazon-session.json';

  const crawler = new PlaywrightCrawler({
    maxConcurrency: 2,
    launchContext: {
      launchOptions: {
        headless: true, // en producción true
      },
    },

    async requestHandler({ page, request, log }) {
      const { id_modelo, ean } = request.userData;
      log.info(`🔍 Visitando URL directa para: "${ean}" (ID_MODELO: ${id_modelo})`);

      await page.waitForTimeout(1000);

      // Aceptar cookies
      const cookiesBtn = await page.$('input#sp-cc-accept, input[name="accept"]');
      if (cookiesBtn) {
        await cookiesBtn.click();
        log.info('✅ Cookies aceptadas');
        await page.waitForTimeout(800);

        // Guardar estado de sesión solo una vez
        if (!fs.existsSync(SESSION_FILE)) {
          const state = await page.context().storageState();
          fs.writeFileSync(SESSION_FILE, JSON.stringify(state));
        }
      }

      // Esperar a que cargue el producto
      await page.waitForSelector('div.rc-inline-gallery.rf-pdp-inline-gallery', { timeout: 15000 }).catch(() => {});



      const allMainImages = await page.$$eval(
      'div.rc-inline-gallery.rf-pdp-inline-gallery img',
      imgs => imgs.map(img => img.src).filter(Boolean)
      );

      // Datos del producto
      const data = {
        id_modelo,
        ean,
        url: request.url,
        title: await page.$eval('h1.rf-pdp-title', el => el.innerText.trim()).catch(() => ''),
        price: await page.$eval('span.rc-prices-fullprice', el => el.innerText.trim()).catch(() => ''),
        mainImage: allMainImages[0] || '',
        allMainImages,
        description: await page.$$eval('div.rc-accordion-content.large-10.rc-accordion-content-nopadding', els => els[0] ? els[0].innerHTML.trim() : '').catch(() => ''),
        desc: await page.$$eval('div.rc-accordion-content.large-10.rc-accordion-content-nopadding', els => els[1] ? els[1].innerHTML.trim() : '').catch(() => ''),
        //desc2: await page.$eval('#productDescription', el => el.innerText.trim()).catch(() => ''),
      };

      // Guardar en un archivo separado por id_modelo
      const outputPath = path.join(OUTPUT_DIR, `${id_modelo}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

      log.info(`💾 Guardado en: ${outputPath}`);
    },
  });

  // --- NUEVO ---
  // En lugar de hacer la búsqueda, las URLs vienen directas desde el JSON
  const startUrls = queries.map(producto => ({
    url: producto.url, // URL final directa
    userData: { id_modelo: producto.id_modelo, ean: producto.ean },
  }));

  await crawler.run(startUrls);
}

start();
