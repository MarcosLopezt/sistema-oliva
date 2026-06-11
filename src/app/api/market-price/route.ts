// =====================================================================
// Precio de mercado — proxy serverless (Mejora 3)
//
// DECISIÓN (Opción B del pedido): usamos un Route Handler de Next como proxy
// en vez de llamar desde el navegador (Opción A). Motivos:
//   - Evita CORS y centraliza la fuente de precios en un solo archivo.
//   - Sigue siendo $0: corre como Serverless Function en el free tier de Vercel.
//
// FUENTE: descartamos las dos primeras candidatas por inviables/inestables:
//   - MercadoLibre (Opción A): API pública 403 (exige token) + listado anti-bot.
//   - Precios Claros (gobierno): pública pero su origen se cae seguido (504).
// Usamos el **catálogo público de Supermercados DIA** (plataforma VTEX): sin
// auth, responde <1s y es estable. Para cambiar de fuente: reescribir searchProducts().
//
// El precio del súper es POR PRESENTACIÓN (un frasco, una botella). Según quién
// llame, lo convertimos a lo que necesita (si no, se infla muchísimo):
//   - `size_ml` (bebidas): matchea la presentación MÁS CERCANA a esa botella y
//     devuelve su precio de góndola (lo que cuesta comprar esa botella).
//   - `unit`   (ingredientes g/kg/ml/l/un): devuelve el precio POR UNIDAD BASE
//     (precio del paquete ÷ tamaño del paquete). Si no puede leer el tamaño en
//     la dimensión pedida (ej: café líquido en ml pero los paquetes vienen en
//     gramos), devuelve 404 en vez de un número absurdo.
//   - nada: mediana cruda de precios de los resultados.
// En todos los casos usamos la MEDIANA para descartar outliers.
// =====================================================================

export const dynamic = "force-dynamic";

const DIA_ENDPOINT =
  "https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search";

function median(values: number[]): number | null {
  const nums = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

// Palabras de marketing que el súper no usa en el nombre y ensucian la búsqueda
// (ej: "Coca-Cola Regular" matchea un combo raro; sin "regular" matchea bien).
const STOPWORDS = new Set(["regular", "comun", "clasico", "clasica", "tradicional"]);

/** Normaliza el término: sin acentos, minúsculas, sin palabras de relleno. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ");
}

/** Lee el tamaño del paquete del nombre, en gramos (masa) o ml (volumen). */
function parseSize(name: string): { g?: number; ml?: number } | null {
  // Ignoramos packs/multipacks: su precio es por varias unidades y rompe el cálculo.
  if (/\bpack\b|x\s*\d+\s*(u|un|unid|unidades|botellas|latas)\b/i.test(name)) {
    return null;
  }
  let m = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grs?|gramos?|g)\b/i);
  if (m) {
    const v = Number(m[1].replace(",", "."));
    if (v > 0) return { g: m[2].toLowerCase().startsWith("k") ? v * 1000 : v };
  }
  m = name.match(/(\d+(?:[.,]\d+)?)\s*(litros?|lts?|l|ml|cc|cm3)\b/i);
  if (m) {
    const v = Number(m[1].replace(",", "."));
    const u = m[2].toLowerCase();
    if (v > 0) return { ml: u[0] === "m" || u[0] === "c" ? v : v * 1000 };
  }
  return null;
}

type Product = { name: string; price: number };

/** Consulta el catálogo de DIA y devuelve {nombre, precio} de los primeros resultados. */
async function searchProducts(term: string): Promise<Product[]> {
  const url = `${DIA_ENDPOINT}?ft=${encodeURIComponent(term)}&_from=0&_to=9`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; OlivaGastronomia/1.0)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  // VTEX responde 206 (Partial Content) por la paginación _from/_to: es OK.
  if (!res.ok && res.status !== 206) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as {
    productName?: string;
    items?: { sellers?: { commertialOffer?: { Price?: number } }[] }[];
  }[];
  if (!Array.isArray(data)) return [];
  return data
    .map((p) => ({
      name: p.productName ?? "",
      price: Number(p.items?.[0]?.sellers?.[0]?.commertialOffer?.Price),
    }))
    .filter((p) => Number.isFinite(p.price) && p.price > 0);
}

/** Bebidas: precio de la presentación más cercana al tamaño de botella buscado. */
function priceBySize(products: Product[], sizeMl: number): number | null {
  const sized = products
    .map((p) => ({ price: p.price, ml: parseSize(p.name)?.ml }))
    .filter((x): x is { price: number; ml: number } => x.ml != null);
  if (sized.length === 0) return median(products.map((p) => p.price));
  const minDist = Math.min(...sized.map((x) => Math.abs(x.ml - sizeMl)));
  const slack = sizeMl * 0.1;
  const near = sized.filter((x) => Math.abs(x.ml - sizeMl) <= minDist + slack);
  const m = median(near.map((x) => x.price));
  return m == null ? null : Math.round(m);
}

/** Ingredientes: precio por unidad base (precio del paquete ÷ tamaño del paquete). */
function priceByUnit(products: Product[], unit: string): number | null {
  const dim =
    unit === "g" || unit === "kg" ? "mass" : unit === "ml" || unit === "l" ? "vol" : "count";
  // 'un': el "paquete" es la unidad → precio del producto tal cual.
  if (dim === "count") return median(products.map((p) => p.price));

  const perUnit = products
    .map((p) => {
      const s = parseSize(p.name);
      if (!s) return null;
      if (dim === "mass" && s.g) return p.price / (unit === "kg" ? s.g / 1000 : s.g);
      if (dim === "vol" && s.ml) return p.price / (unit === "l" ? s.ml / 1000 : s.ml);
      return null;
    })
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);

  const m = median(perUnit);
  // Sin tamaños legibles en la dimensión pedida: mejor 404 que un precio absurdo.
  return m == null ? null : Math.round(m * 100) / 100;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const sizeMl = Number(params.get("size_ml")) || null;
  const unit = params.get("unit");
  if (!q) {
    return Response.json({ error: "Falta el parámetro 'q'." }, { status: 400 });
  }

  try {
    const term = normalize(q);
    // 1) Búsqueda con el término completo. 2) Si no hay resultados, reintenta
    //    con la primera palabra (ej: "cafe expreso" → "cafe"), más amplia.
    let products = await searchProducts(term);
    const firstWord = term.split(" ")[0];
    if (products.length === 0 && firstWord && firstWord !== term) {
      products = await searchProducts(firstWord);
    }

    let price: number | null;
    if (sizeMl && sizeMl > 0) price = priceBySize(products, sizeMl);
    else if (unit) price = priceByUnit(products, unit);
    else price = median(products.map((p) => p.price));

    if (price == null) {
      return Response.json({ error: "Sin resultados de precio." }, { status: 404 });
    }
    return Response.json({ price, count: products.length });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Error de red." },
      { status: 502 },
    );
  }
}
