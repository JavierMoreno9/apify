import fs, { link } from 'fs';
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
      log.info(`🔍 Buscando modelo: "${modelo}" (id_modelo: ${id_modelo})`);

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
        'div.section.panel.panel-default a',
        { timeout: 15000 }
      );

      // Obtener href del primer product link
      const firstProductLink = await page.$eval(
        'div.section.panel.panel-default a',
        el => el.href
      );

      log.info(`Primer producto encontrado: ${firstProductLink}`)

      // Navegar al producto
      await page.goto(firstProductLink, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('div.pinfo.row img', { timeout: 15000 }).catch(() => {});

    const allMainImages = await page.$$eval(
      'div.pinfo.row img',
      imgs => imgs.map(img => img.src).filter(Boolean)
    );

    /*const video = await page.$eval(
      'div.videoWrapper iframe',
      links => links.map(link => link.src).filter(Boolean)
    );*/

    /*const allDesc = await page.$$eval(
      'span.leading-snug.block',
      descs => descs.map(desc => desc.innerText).filter(Boolean).join("|")
    );*/

      // Datos del producto
  const title = await page.$eval('h1.title', el => el.innerText.trim()).catch(() => '');
  const price = await page.$eval('span.price-tag', el => el.innerText.trim()).catch(() => '');
  const description = await page.$eval('#specifications-collapse', el => el.innerText.trim()).catch(() => '');
  const desc = await page.$eval('#description-collapse', el => el.innerText.trim()).catch(() => '');
  const referenciaWeb = await page.$$eval('p.product-model.float-sm-left span.badge.badge-lighter', el => el.innerText.trim()).catch(() => '');
  //const ean = await page.$$eval('div.sku-info span.value', els => els[1] ? els[1].innerText.trim() : '').catch(() => '');
  //const desc2 = await page.$$eval('table.min-w-full.bg-white.border-gray-300', els => (els[2] ? els[2].innerHTML.trim() : ""));

  // Ahora construimos el objeto
  const data = {
    id_modelo,
    modelo,
    //ean,
    referenciaWeb,
    url: firstProductLink,
    title,
    price,
    mainImage: allMainImages[0] || '',
    allMainImages, // <-- todas las imágenes lazyloaded
    desc,
    description,
    //video
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
    url: `https://thinktankphoto.de/de/search?page=search&page_action=query&desc=&sdesc=&keywords=${encodeURIComponent(producto.modelo)}`,
    userData: { id_modelo: producto.id_modelo, modelo: producto.modelo },
  }));

  await crawler.run(startUrls);
}

start();
