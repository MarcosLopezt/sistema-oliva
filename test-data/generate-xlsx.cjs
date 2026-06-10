/* Genera los archivos .xlsx de prueba para Oliva Gastronomía.
 * Uso: node test-data/generate-xlsx.cjs
 *
 * Los archivos de proveedor son "limpios": solo las columnas que un proveedor
 * real mandaría, con los nombres de encabezado que el importador reconoce. Se
 * varían los encabezados entre archivos a propósito (Producto/Descripción/
 * Artículo, Precio/Costo, Unidad de venta/Presentación/Unidad, Cant. por
 * unidad/Contenido/Cantidad por unidad) para probar el mapeo por sinónimos.
 *
 * El importador deriva:
 *   - base_unit + pack_size desde "Cant. por unidad" (kg→g, L→ml)
 *   - sale_unit desde "Unidad de venta"
 */
const XLSX = require("xlsx");
const path = require("path");

const OUT = __dirname;

function writeSheet(filename, sheetName, header, dataRows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path.join(OUT, filename));
  console.log("✓", filename, `(${dataRows.length} filas)`);
}

// ---------------------------------------------------------------- Recetas
// (formato del importador de recetas: una hoja plana, columna "receta" por fila)
const recetasHeader = ["receta", "categoria", "ingrediente", "cantidad", "unidad"];
const recetas = [
  ["Lomo al champignon", "principal", "Lomo vacuno", 250, "g"],
  ["Lomo al champignon", "principal", "Champignones frescos", 80, "g"],
  ["Lomo al champignon", "principal", "Crema de leche", 50, "ml"],
  ["Lomo al champignon", "principal", "Vino blanco", 30, "ml"],
  ["Lomo al champignon", "principal", "Manteca", 20, "g"],
  ["Lomo al champignon", "principal", "Ajo", 5, "g"],
  ["Lomo al champignon", "principal", "Sal", 3, "g"],
  ["Lomo al champignon", "principal", "Pimienta negra", 2, "g"],
  ["Lomo al champignon", "principal", "Perejil", 5, "g"],
  ["Pollo relleno con verduras", "principal", "Pechuga de pollo", 220, "g"],
  ["Pollo relleno con verduras", "principal", "Pimiento rojo", 60, "g"],
  ["Pollo relleno con verduras", "principal", "Espinaca", 40, "g"],
  ["Pollo relleno con verduras", "principal", "Queso cremoso", 30, "g"],
  ["Pollo relleno con verduras", "principal", "Cebolla", 50, "g"],
  ["Pollo relleno con verduras", "principal", "Aceite de girasol", 20, "ml"],
  ["Pollo relleno con verduras", "principal", "Sal", 3, "g"],
  ["Pollo relleno con verduras", "principal", "Pimienta negra", 2, "g"],
  ["Tiramisú", "postre", "Queso mascarpone", 80, "g"],
  ["Tiramisú", "postre", "Huevos", 60, "g"],
  ["Tiramisú", "postre", "Azúcar", 30, "g"],
  ["Tiramisú", "postre", "Vainillas", 40, "g"],
  ["Tiramisú", "postre", "Café expreso", 60, "ml"],
  ["Tiramisú", "postre", "Cacao amargo", 5, "g"],
  ["Tiramisú", "postre", "Licor de café", 10, "ml"],
];
writeSheet("recetas_prueba.xlsx", "Recetas", recetasHeader, recetas);

// ------------------------------------------------ Proveedor: El Gaucho
// Encabezados "clásicos".
writeSheet(
  "proveedor_gaucho.xlsx",
  "El Gaucho",
  ["Producto", "Precio", "Unidad de venta", "Cant. por unidad"],
  [
    ["Lomo vacuno", 12500, "kg", "1 kg"],
    ["Pechuga de pollo", 4800, "kg", "1 kg"],
    ["Crema de leche", 1200, "pote", "1 L"],
    ["Manteca", 2100, "paquete", "500 g"],
    ["Queso cremoso", 3400, "kg", "1 kg"],
    ["Queso mascarpone", 5800, "pote", "250 g"],
    ["Queso parmesano", 6200, "kg", "1 kg"],
    ["Huevos", 2160, "docena", "720 g"],
  ],
);

// ------------------------------------------------ Proveedor: Don Roque
// Encabezados alternativos: Descripción / Precio venta / Presentación / Contenido.
writeSheet(
  "proveedor_don_roque.xlsx",
  "Don Roque",
  ["Descripción", "Precio venta", "Presentación", "Contenido"],
  [
    ["Champignones frescos", 2800, "kg", "1 kg"],
    ["Pimiento rojo", 1500, "kg", "1 kg"],
    ["Espinaca", 900, "kg", "1 kg"],
    ["Cebolla", 600, "bolsa", "1 kg"],
    ["Ajo", 320, "cabeza", "100 g"],
    ["Perejil", 400, "atado", "50 g"],
    ["Hongos secos", 450, "bolsa", "100 g"],
  ],
);

// ------------------------------------------------ Proveedor: La Despensa
// Encabezados alternativos: Artículo / Costo / Unidad / Cantidad por unidad.
writeSheet(
  "proveedor_despensa.xlsx",
  "La Despensa",
  ["Artículo", "Costo", "Unidad", "Cantidad por unidad"],
  [
    ["Arroz arbóreo", 2200, "bolsa", "1 kg"],
    ["Vino blanco", 3500, "botella", "750 ml"],
    ["Aceite de girasol", 1800, "botella", "1500 ml"],
    ["Aceite de oliva", 5200, "botella", "500 ml"],
    ["Azúcar", 800, "paquete", "1 kg"],
    ["Cacao amargo", 3100, "paquete", "200 g"],
    ["Vainillas", 2400, "paquete", "200 g"],
    ["Sal", 350, "paquete", "1 kg"],
    ["Pimienta negra", 4800, "frasco", "50 g"],
    ["Licor de café", 8500, "botella", "750 ml"],
  ],
);

// ------------------------------------------------ Vajillería Finos
writeSheet(
  "vajilla_finos.xlsx",
  "Finos",
  ["Artículo", "Precio", "Unidad de venta", "Cant. por unidad"],
  [
    ["Plato playo", 850, "caja", "6 un"],
    ["Plato de postre", 620, "caja", "6 un"],
    ["Copa de vino", 950, "caja", "6 un"],
    ["Copa de agua", 750, "caja", "6 un"],
    ["Tenedor", 380, "caja", "12 un"],
    ["Cuchillo", 420, "caja", "12 un"],
    ["Cuchara", 360, "caja", "12 un"],
    ["Cucharita de postre", 280, "caja", "12 un"],
    ["Servilleta de tela", 450, "paquete", "10 un"],
  ],
);

console.log("\nListo. Archivos en", OUT);
