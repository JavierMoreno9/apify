import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { fileURLToPath } from "url";

// ==== CONFIGURACIÓN ====
// Primero creamos __filename y __dirname porque no existen en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ahora sí, definimos la carpeta usando path.resolve
const CARPETA_JSON = path.resolve(__dirname, "src", "output");
const ARCHIVO_CSV = path.resolve(__dirname, "resultado.csv");
// =======================

function leerJSONs(carpeta) {
  const archivos = fs.readdirSync(carpeta);
  const registros = [];

  console.log(`📂 Leyendo JSONs desde: ${carpeta}\n`);

  archivos.forEach((archivo) => {
    if (archivo.toLowerCase().endsWith(".json")) {
      const ruta = path.join(carpeta, archivo);

      try {
        const contenido = fs.readFileSync(ruta, "utf-8");
        const data = JSON.parse(contenido);

        // Si es un array, cada elemento se agrega como fila
        if (Array.isArray(data)) {
          data.forEach((item) => registros.push({ _archivo: archivo, ...item }));
        }
        // Si es un objeto, se agrega directo
        else if (typeof data === "object" && data !== null) {
          registros.push({ _archivo: archivo, ...data });
        } else {
          console.warn(`⚠️ Formato no reconocido en: ${archivo}`);
        }
      } catch (error) {
        console.error(`❌ Error leyendo ${archivo}:`, error.message);
      }
    }
  });

  return registros;
}

function exportarCSV(registros) {
  if (!registros.length) {
    console.warn("⚠️ No se encontraron datos para exportar.");
    return;
  }

  const csv = Papa.unparse(registros, { header: true });
  fs.writeFileSync(ARCHIVO_CSV, csv, "utf-8");
  console.log(`✅ CSV generado en: ${ARCHIVO_CSV}`);
}

function main() {
  console.log("Ruta final:", CARPETA_JSON);
  const registros = leerJSONs(CARPETA_JSON);
  exportarCSV(registros);
  console.log("🚀 Proceso completado con éxito.");
}

main();
