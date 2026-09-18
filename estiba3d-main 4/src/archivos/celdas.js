// ================= Celdas =================
// Lectura tolerante de hojas de Excel capturadas a mano: encabezados y valores se normalizan
// (sin acentos, sin paréntesis, sin espacios) para que "Largo (mm)" y "largo" sean la misma columna.
import * as XLSX from "xlsx";

// Normaliza un código (SKU o ID producto) para compararlo entre archivos distintos.
// Dos problemas reales de Excel que esto evita:
// - Si un código puramente numérico se guardó como texto en un archivo ("0500123") y como número
//   en otro (500123), Excel le quita los ceros a la izquierda al segundo. Sin esto, la herramienta
//   los trataría como productos distintos y reportaría "no encontrado" aunque sí esté en el maestro.
// - Un código con punto ("500123.0", que Excel produce solo con celdas numéricas) no debe fusionarse
//   en "5001230" al quitarle la puntuación; se normaliza como número antes de quitar símbolos.
export const clave = (t) => {
  let s = String(t ?? "").trim();
  if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) s = String(Number(s));
  s = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
  if (/^0+\d+$/.test(s)) s = s.replace(/^0+/, "");
  return s;
};
export const siNo = (v, def) => (v === undefined || v === null || String(v).trim() === "" ? def : ["si", "s", "yes", "y", "1", "true", "x", "verdadero"].includes(clave(v)));
export const numero = (v, def = 0) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : def; };

// Filas de una hoja como objetos con claves normalizadas. El encabezado es la primera fila que tenga SKU, Nombre o Código.
export function hojaAObjetos(ws) {
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const hi = filas.findIndex((f) => f.some((c) => ["sku", "nombre", "codigo"].includes(clave(c))));
  if (hi < 0) return [];
  const heads = filas[hi].map(clave);
  return filas.slice(hi + 1).filter((f) => f.some((c) => String(c).trim() !== "")).map((f) => { const o = {}; heads.forEach((h, i) => { if (h && o[h] === undefined) o[h] = f[i]; }); return o; });
}
export const buscarHoja = (wb, nombres) => { for (const n of wb.SheetNames) if (nombres.includes(clave(n))) return wb.Sheets[n]; return null; };
