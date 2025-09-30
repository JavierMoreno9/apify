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
      const { ean, modelo } = request.userData;
      log.info(`🔍 Buscando modelo: "${modelo}" (EAN: ${ean})`);

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
      await page.waitForSelector('div[data-csa-c-type="item"] a.a-link-normal.s-no-outline', { timeout: 15000 });

      // Primer resultado orgánico
      const firstProductLink = await page.$eval(
        'div[data-csa-c-type="item"] a.a-link-normal.s-no-outline',
        el => el.href
      );
      log.info(`Primer producto encontrado: ${firstProductLink}`);

      // Navegar al producto
      await page.goto(firstProductLink, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#productTitle', { timeout: 15000 }).catch(() => {});

      // Extraer imágenes de alta resolución
      const getAllImagesHiRes = async () => {
        const urls = new Set();

        // A) imageBlockState
        const blocks = await page.$$eval(
          'script[type="a-state"][data-a-state*="imageBlockState"], script[data-a-state*="imageBlockState"]',
          nodes => nodes.map(n => n.textContent || '')
        ).catch(() => []);

        for (const txt of blocks || []) {
          try {
            const json = JSON.parse(txt);
            const arr = json?.colorImages?.initial || [];
            for (const img of arr) {
              const u = img.hiRes || img.large || img.mainUrl || '';
              if (u && u.startsWith('http')) urls.add(u);
            }
          } catch {}
        }

        // B) Fallback DOM
        const domImgs = await page.$$eval('#landingImage, li.image.item img', imgs =>
          imgs.map(img => img.getAttribute('data-old-hires') || img.src).filter(Boolean)
        ).catch(() => []);

        for (const u of domImgs) {
          if (u.startsWith('http')) urls.add(u);
        }

        return Array.from(urls).slice(0, 6);
      };

      const allMainImages = await getAllImagesHiRes();

      // Datos del producto
      const data = {
        ean,
        modelo,
        url: firstProductLink,
        title: await page.$eval('#productTitle', el => el.innerText.trim()).catch(() => ''),
        price: await page.$eval('.a-price .a-offscreen', el => el.innerText.trim()).catch(() => ''),
        mainImage: allMainImages[0] || '',
        allMainImages,
        description: await page.$eval('#feature-bullets', el => el.innerText.trim()).catch(() => ''),
        desc: await page.$eval('#detailBullets_feature_div', el => el.innerText.trim()).catch(() => ''),
        desc2: await page.$eval('#productDescription', el => el.innerText.trim()).catch(() => ''),
      };

      // Guardar en un archivo separado por EAN
      const outputPath = path.join(OUTPUT_DIR, `${ean}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

      log.info(`💾 Guardado en: ${outputPath}`);
    },
  });

  // Generar URLs a partir del JSON cargado
  const startUrls = queries.map(producto => ({
    url: `https://www.amazon.es/s?k=${encodeURIComponent(producto.modelo)}`,
    userData: { ean: producto.ean, modelo: producto.modelo },
  }));

  await crawler.run(startUrls);
}

start();
