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
        'div.article a',
        { timeout: 15000 }
      );

      // Obtener href del primer product link
      const firstProductLink = await page.$eval(
        'div.article a',
        el => el.href
      );

      log.info(`Primer producto encontrado: ${firstProductLink}`)

      // Navegar al producto
      await page.goto(firstProductLink, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('img.lazyloaded', { timeout: 15000 }).catch(() => {});

    const allMainImages = await page.$$eval(
      '#images button.productzoom',
      buttons => buttons
        .map(btn => btn.getAttribute('href'))
        .filter(Boolean)
    );

    const description = await page.$$eval(
      'ul.specifications li',
      els => els.map(el => el.innerText.trim()).join('|')
    ).catch(() => '');

      // Datos del producto
  const title = await page.$eval('h1', el => el.innerText.trim()).catch(() => '');
  const price = await page.$eval('div.price', el => el.innerText.trim()).catch(() => '');
  /*const description = await page.$$eval('details', els => els[0] ? els[0].innerHTML.trim() : '').catch(() => '');
  const desc = await page.$$eval('details', els => els[1] ? els[1].innerHTML.trim() : '').catch(() => '');
  const desc2 = await page.$$eval('details', els => els[2] ? els[2].innerHTML.trim() : '').catch(() => '');
  const desc3 = await page.$$eval('details', els => els[3] ? els[3].innerHTML.trim() : '').catch(() => '');
  const desc4 = await page.$$eval('details', els => els[4] ? els[4].innerHTML.trim() : '').catch(() => '');
  const desc5 = await page.$$eval('details', els => els[5] ? els[5].innerHTML.trim() : '').catch(() => '');
  const desc6 = await page.$$eval('details', els => els[6] ? els[6].innerHTML.trim() : '').catch(() => '');*/
  // Ahora construimos el objeto
  const data = {
    id_modelo,
    modelo,
    url: firstProductLink,
    title,
    price,
    mainImage: allMainImages[0] || '',
    allMainImages, // <-- todas las imágenes lazyloaded
    description,
    /*desc,
    desc2,
    desc3,
    desc4,
    desc5,
    desc6*/
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
    url: `https://www.liv-cycling.com/es/search?keyword=${encodeURIComponent(producto.modelo)}`,
    userData: { id_modelo: producto.id_modelo, modelo: producto.modelo },
  }));

  await crawler.run(startUrls);
}

start();
