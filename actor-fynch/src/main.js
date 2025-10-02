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
  const SESSION_FILE = 'session.json';

  const crawler = new PlaywrightCrawler({
    maxConcurrency: 2,
    launchContext: {
      launchOptions: {
        headless: true, // en producción true
      },
    },

    async requestHandler({ page, request, log }) {
      const { id_modelo, modelo } = request.userData;
      log.info(`🔍 Buscando modelo: "${modelo}" (ID_MODELO: ${id_modelo})`);

      await page.waitForTimeout(1000);

      // Aceptar cookies
      const cookiesBtn = await page.$('input#sp-cc-accept, input[name="accept"]');
      if (cookiesBtn) {
        await cookiesBtn.click();
        log.info('✅ Cookies aceptadas');
        await page.waitForTimeout(800);

        if (!fs.existsSync(SESSION_FILE)) {
          const state = await page.context().storageState();
          fs.writeFileSync(SESSION_FILE, JSON.stringify(state));
        }
      }

      // Esperar a que aparezcan resultados
      await page.waitForSelector(
        'div.boost-sd__product-item-grid-view-layout-image a',
        { timeout: 15000 }
      );

      // Obtener href del primer product link
      const firstProductLink = await page.$eval(
        'div.boost-sd__product-item-grid-view-layout-image a',
        el => el.href
      );

      log.info(`Primer producto encontrado: ${firstProductLink}`)

      // Navegar al producto
      await page.goto(firstProductLink, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('div.image-wrap.loaded', { timeout: 15000 }).catch(() => {});

    const allMainImages = await page.$$eval(
      'div.image-wrap.loaded img',
      imgs => imgs.map(img => img.src).filter(Boolean)
    );

      // Datos del producto
  const title = await page.$eval('h1.h2.product-single__title', el => el.innerText.trim()).catch(() => '');
  const price = await page.$eval('span.product__price', el => el.innerText.trim()).catch(() => '');
  const description = await page.$$eval('div.collapsibles-wrapper.collapsibles-wrapper--border-bottom', els => els[0] ? els[0].innerHTML.trim() : '').catch(() => '');
  const desc = await page.$$eval('div.collapsibles-wrapper.collapsibles-wrapper--border-bottom', els => els[1] ? els[1].innerHTML.trim() : '').catch(() => '');
  const desc2 = await page.$$eval('div.collapsibles-wrapper.collapsibles-wrapper--border-bottom', els => els[2] ? els[2].innerHTML.trim() : '').catch(() => '');
  const referenciaWeb = await page.$eval('p.product-single__sku', el => el.innerText.trim()).catch(() => '');

  // Ahora construimos el objeto
  const data = {
    id_modelo,
    modelo,
    referenciaWeb,
    url: firstProductLink,
    title,
    price,
    mainImage: allMainImages[0] || '',
    allMainImages, // <-- todas las imágenes lazyloaded
    description,
    desc,
    desc2,
  };

      // Guardar en un archivo separado por id_modelo
      const outputPath = path.join(OUTPUT_DIR, `${id_modelo}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

      log.info(`💾 Guardado en: ${outputPath}`);
      /*await page.close();
      log.info(`🧹 Memoria liberada para: ${request.url}`);*/
    },
  });

  // Generar URLs a partir del JSON cargado
  const startUrls = queries.map(producto => ({
    url: `https://fynch-hatton.de/en/search?q=${encodeURIComponent(producto.modelo)}`,
    userData: { id_modelo: producto.id_modelo, modelo: producto.modelo },
  }));

  await crawler.run(startUrls);
}

start();
