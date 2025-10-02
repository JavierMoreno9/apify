import fs from "fs";
import Papa from "papaparse";
import { franc } from "franc-min";
import path from "path";

// ==== CONFIGURACIÓN ====
const ARCHIVO_ENTRADA = path.resolve("resultados", "idiomas_mezclados.csv");
const ARCHIVO_SALIDA = path.resolve("resultados", "resultado_con_idioma.csv");
// =======================

// Función para limpiar y detectar idioma
function detectarIdioma(texto) {
  if (!texto || texto.trim().length === 0) return "vacio";

  // Quitar todo excepto letras y espacios
  const limpio = texto.replace(/[^a-zA-ZÀ-ÿ\s]/g, "").trim();

  // Si queda muy corto, no se puede detectar bien
  if (limpio.length < 20) return "muy_corto";

  const codigo = franc(limpio);
  return codigo !== "und" ? codigo : "desconocido";
}

// Leer CSV correctamente
const contenido = fs.readFileSync(ARCHIVO_ENTRADA, "utf-8");

const parsed = Papa.parse(contenido, {
  header: true,
  skipEmptyLines: true,
  quoteChar: '"',    // respeta comillas
  escapeChar: '"',   // para escapar comillas internas
});

// DEBUG: comprobar la primera fila
console.log("Primera fila parseada:", parsed.data[0]);

// Procesar filas
const datosConIdioma = parsed.data.map((fila) => {
  // Unir texto de varias columnas
  const textoCompleto = `${fila.description || ""} ${fila.desc || ""} ${fila.desc2 || ""}`.trim();

  // Detectar idioma
  fila["idioma_detectado"] = detectarIdioma(textoCompleto);
  return fila;
});

// Exportar nuevo CSV
const csvFinal = Papa.unparse(datosConIdioma, { header: true });
fs.writeFileSync(ARCHIVO_SALIDA, csvFinal, "utf-8");

console.log(`✅ Archivo generado con idiomas detectados: ${ARCHIVO_SALIDA}`);
