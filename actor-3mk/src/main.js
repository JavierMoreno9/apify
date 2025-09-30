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
    maxConcurrency: 1,
    launchContext: {
      launchOptions: {
        headless: true, // en producción true
      },
    },

    async requestHandler({ page, request, log }) {
      const { id_modelo, modelo } = request.userData;
      log.info(`🔍 Buscando modelo: "${modelo}" (id_modelo: ${id_modelo})`);

      await page.waitForTimeout(1000);

      // Aceptar cookies si aparecen
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

      await page.waitForTimeout(1500 + Math.floor(Math.random() * 2500));

      // Ir directamente a la URL de búsqueda
      await page.goto(`https://3mk.global/search/${encodeURIComponent(modelo)}`, {
        waitUntil: 'domcontentloaded',
      });

      // Guardar la URL final después del redirect
      const finalUrl = page.url();
      log.info(`🌍 URL final: ${finalUrl}`);

      // Esperar a que cargue la galería de imágenes
      await page.waitForSelector('div[data-gallery-role="gallery"]', { timeout: 15000 }).catch(() => {});

      // Obtener todas las imágenes
      const allMainImages = await page.$$eval(
        'div[data-gallery-role="gallery"] img',
        imgs => imgs.map(img => img.src).filter(Boolean)
      );

      // Extraer datos del producto
      const title = await page.$eval('h1.page-title', el => el.innerText.trim()).catch(() => '');
      const price = await page.$eval('span.price', el => el.innerText.trim()).catch(() => '');
      const description = await page.$eval('div.data.item.content.description', el => el ? el.innerText.trim() : '').catch(() => '');
      const referenciaWeb = await page.$eval("td[data-th='EAN']", el => el.innerText.trim()).catch(() => '');

      // Construir el objeto final
      const data = {
        id_modelo,
        referenciaWeb,
        modelo,
        url: finalUrl,
        title,
        price,
        mainImage: allMainImages[0] || '',
        allMainImages,
        description,
      };

      // Guardar el resultado en un archivo JSON separado por id_modelo
      const outputPath = path.join(OUTPUT_DIR, `${id_modelo}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

      log.info(`💾 Guardado en: ${outputPath}`);
    },
  });

  // Generar URLs iniciales a partir de queries.json
  const startUrls = queries.map(producto => ({
    url: `https://3mk.global/search/${encodeURIComponent(producto.modelo)}`,
    userData: { id_modelo: producto.id_modelo, modelo: producto.modelo },
  }));

  await crawler.run(startUrls);
}

start();
