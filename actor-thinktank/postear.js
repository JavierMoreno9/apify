import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const folderPath = './src/output'; // Carpeta donde tienes tus JSONs
const endpoint = 'https://pmsk8.t1nn.net/apify/actor-motocard/insert_all_jsons.php';

async function enviarDatos() {
  try {
    // 1. Leer todos los archivos JSON
    const files = fs.readdirSync(folderPath);
    const allData = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
        try {
          const jsonData = JSON.parse(content);
          allData.push(jsonData);
        } catch (err) {
          console.error(`❌ Error parseando ${file}:`, err.message);
        }
      }
    }

    if (allData.length === 0) {
      console.log('⚠️ No se encontraron datos válidos para enviar.');
      return;
    }

    console.log(`📦 Enviando ${allData.length} registros al servidor...`);

    const prueba = allData[0];

    // 2. Enviar al servidor
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prueba),
    });

    const rawText = await response.text();
    console.log('Respuesta cruda:', rawText);   

    // 3. Verificar respuesta del servidor
    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await response.json();
    console.log('✅ Respuesta del servidor:', result);


  } catch (err) {
    console.error('❌ Error general:', err.message);
  }
}

enviarDatos();
