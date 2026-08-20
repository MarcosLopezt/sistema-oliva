import { convert } from "@/lib/cost";
import { formatNum, formatDate } from "@/lib/format";
import type {
  ContentUnit,
  EventRow,
  EventRecipeWithRecipe,
  IngredientWithProduct,
  UnitKind,
} from "@/lib/types";

export type SelectionUnits = {
  eventRecipeId: string;
  recipeId: string;
  recipeName: string;
  role: EventRecipeWithRecipe["role"];
  units: number;
};

/**
 * Cantidad de unidades a producir por cada receta elegida, según los ratios del evento.
 *  - bocado: bocados_per_person × (PAX + extra) (por cada variedad)
 *  - postre: 1 × PAX
 *  - principal + veggie: (PAX + extra) platos, repartidos veggie_pct / resto
 *
 * `principal_extra` son cubiertos de más que se producen por las dudas. Cubre
 * tanto los principales como los bocados: si vienen personas de más, comen
 * bocados igual que plato principal.
 */
export function selectionUnits(
  event: EventRow,
  selections: EventRecipeWithRecipe[],
): SelectionUnits[] {
  const veggieList = selections.filter((s) => s.role === "principal_veggie");
  const normalList = selections.filter((s) => s.role === "principal");

  const totalPrincipal = event.pax + event.principal_extra;
  const veggieTotal = Math.round(totalPrincipal * event.veggie_pct);
  const normalTotal = Math.max(0, totalPrincipal - veggieTotal);

  return selections.map((s) => {
    let units = 0;
    if (s.role === "bocado") units = event.bocados_per_person * totalPrincipal;
    else if (s.role === "postre") units = event.pax;
    else if (s.role === "principal_veggie")
      units = veggieList.length ? veggieTotal / veggieList.length : 0;
    else if (s.role === "principal")
      units = normalList.length ? normalTotal / normalList.length : 0;

    return {
      eventRecipeId: s.id,
      recipeId: s.recipe_id,
      recipeName: s.recipe?.name ?? "—",
      role: s.role,
      units,
    };
  });
}

export type MPLine = {
  /**
   * Id del primer ingrediente de la línea. Sirve como clave estable de React y
   * para buscar el ingrediente en las líneas de precio de mercado (donde
   * siempre hay uno solo). Para consolidar, usar `ingredientIds`.
   */
  ingredientId: string;
  /**
   * Todos los ingredientes que se abastecen con este producto. Puede tener más
   * de uno: dos ingredientes distintos ("Aceite", "Aceite de oliva") pueden
   * apuntar al mismo producto y se compran juntos en una sola línea.
   */
  ingredientIds: string[];
  /** Nombre para mostrar. Con varios ingredientes, van unidos por " + ". */
  ingredientName: string;
  /** Nombre del producto del proveedor, o null si es precio de mercado. */
  productName: string | null;
  /**
   * Si el precio del producto ya trae IVA. Informativo (ver Product.price).
   * null en las líneas de precio de mercado, que no tienen el dato.
   */
  priceIncludesIva: boolean | null;
  /** Cantidad a comprar (packs si hay producto; cantidad en unidad base si es mercado). */
  buyQty: number;
  buyUnitLabel: string;
  /** Cantidad total en la unidad base del producto (packs × pack_size). */
  totalBaseQty: number;
  baseUnitLabel: string;
  /** Etiqueta de la unidad de venta del proveedor (ej "caja", "bidón"), si existe. */
  saleUnit: string | null;
  priceEach: number;
  subtotal: number;
  /**
   * MODELO TRES CAPAS (solo cuando el producto tiene unit_content):
   * Unidades individuales realmente necesarias antes de redondear a packs.
   * Ej: se necesitan 1.643 botellas → unitsNeeded = 2.
   */
  unitsNeeded: number | null;
  /** Tamaño del pack (unidades por caja). Solo con unit_content. */
  unitsPerPack: number | null;
  /**
   * Unidades sobrantes al comprar packs completos (packs × pack_size − unitsNeeded).
   * Ej: comprar 1 caja (6 un) pero necesitar 2 → surplusUnits = 4.
   */
  surplusUnits: number | null;
  /**
   * Cantidad realmente necesaria —con merma y ya consolidada por producto—
   * expresada en la misma unidad que `totalBaseQty`, SIN redondear a packs.
   * Es el número que el motor calcula justo antes del `ceil`.
   *
   * DATO DE SALIDA: no participa de ningún cálculo de costo. Se expone para la
   * sección Sobrantes, que necesita saber cuánto se pagó de más.
   *
   * NO CONFUNDIR CON `surplusUnits` — son dos cosas distintas:
   *  · `surplusUnits` = unidades ENTERAS SIN ABRIR que sobran al comprar packs
   *    completos (packs × pack_size − unitsNeeded). Solo en modelo tres capas.
   *  · `totalBaseQty − neededBaseQty` = SOBRANTE REAL, que además incluye el
   *    contenido que queda dentro de la unidad ya abierta.
   *
   * Ejemplo del aceite (botella de 5 L): se necesitan 1,38 botellas → se
   * compran 2 → `surplusUnits` = 0 (ninguna botella quedó cerrada), pero el
   * sobrante real es 2 − 1,38 = 0,62 botellas = 3,1 L pagados sin usar.
   */
  neededBaseQty: number;
};

export type MPGroup = {
  provider: string;
  /** id del proveedor (null para el grupo "Precio de mercado"). */
  providerId: string | null;
  /** Teléfono / WhatsApp del proveedor, si está cargado. */
  phone: string | null;
  lines: MPLine[];
  subtotal: number;
};

export type MPProblem = { ingredientName: string; reason: string };

/**
 * Desglose informativo del total según la base de IVA de cada línea.
 * NO altera el total: solo lo parte en tres para la contabilidad de Oliva.
 */
export type IvaBreakdown = {
  /** Subtotal de líneas cuyo precio ya incluye IVA. */
  withIva: number;
  /** Subtotal de líneas cuyo precio no incluye IVA. */
  withoutIva: number;
  /** Subtotal sin dato: precio de mercado, sin producto de proveedor. */
  unknown: number;
};

export type MateriaPrimaResult = {
  groups: MPGroup[];
  problems: MPProblem[];
  total: number;
  perPerson: number;
  ivaBreakdown: IvaBreakdown;
};

type Need = { ingredient: IngredientWithProduct; baseQty: number };

/** Producto vinculado a un ingrediente (con su proveedor embebido). */
type LinkedProduct = NonNullable<IngredientWithProduct["product"]>;

/**
 * Necesidad acumulada de UN producto, sumando todos los ingredientes que se
 * abastecen con él. `productQty` está siempre expresada en `product.base_unit`,
 * que es la unidad común que permite sumar antes de redondear.
 */
type ProductNeed = {
  product: LinkedProduct;
  ingredients: IngredientWithProduct[];
  productQty: number;
  /** true = modelo tres capas (producto en 'un' con contenido por unidad). */
  threeLayer: boolean;
};

const MERCADO = "Precio de mercado";

function unitLbl(u: UnitKind): string {
  return u === "l" ? "L" : u;
}

/**
 * Ceil tolerante al ruido de punto flotante. Al consolidar varios ingredientes
 * la suma puede dar 2.0000000000000004, y un ceil crudo compraría una unidad
 * de más. Se descarta el ruido por debajo del microgramo/microlitro.
 */
function ceilQty(q: number): number {
  return Math.ceil(Number(q.toFixed(6)));
}

/** Producto de tres capas, con el contenido por unidad ya garantizado. */
type ThreeLayerProduct = LinkedProduct & {
  unit_content_value: number;
  unit_content_unit: ContentUnit;
};

/**
 * true si el producto usa el modelo tres capas (unidad + contenido por unidad).
 * Es un type guard: adentro del if, el contenido deja de ser nullable.
 */
function isThreeLayer(prod: LinkedProduct): prod is ThreeLayerProduct {
  return (
    prod.base_unit === "un" &&
    prod.unit_content_value != null &&
    prod.unit_content_unit != null
  );
}

/**
 * Expresa la necesidad de un ingrediente en la unidad base de su producto.
 *  - Camino directo: dimensiones compatibles (ej: ingrediente en ml, producto en L).
 *  - Camino tres capas: producto en 'un' con contenido; el resultado son
 *    unidades individuales (botellas), que es justamente `prod.base_unit`='un'.
 * Devuelve null si no hay forma de convertir (config incompatible).
 */
function qtyInProductUnits(
  ing: IngredientWithProduct,
  prod: LinkedProduct,
  baseQty: number,
): number | null {
  const directFactor = convert(1, ing.base_unit, prod.base_unit);
  if (directFactor != null) return baseQty * directFactor;

  if (isThreeLayer(prod)) {
    const contentFactor = convert(1, ing.base_unit, prod.unit_content_unit);
    if (contentFactor != null) {
      return (baseQty * contentFactor) / prod.unit_content_value;
    }
  }
  return null;
}

/** Motivo por el que un ingrediente no se pudo expresar en unidades del producto. */
function conversionProblem(
  ing: IngredientWithProduct,
  prod: LinkedProduct,
): string {
  if (prod.base_unit === "un" && !prod.unit_content_value) {
    return "producto en unidades sin contenido configurado — editá el producto y cargá su contenido por unidad";
  }
  if (isThreeLayer(prod)) {
    return `unidad incompatible con contenido del producto (${ing.base_unit} vs ${prod.unit_content_unit})`;
  }
  return "unidad del producto incompatible";
}

/** Calcula la materia prima del evento: necesidades, lista de compra por proveedor y total. */
export function computeMateriaPrima(
  event: EventRow,
  selections: EventRecipeWithRecipe[],
): MateriaPrimaResult {
  const units = new Map(
    selectionUnits(event, selections).map((s) => [s.eventRecipeId, s.units]),
  );

  // 1) Agregar necesidades por ingrediente (en su unidad base, con merma).
  const needs = new Map<string, Need>();
  const problems: MPProblem[] = [];
  const mermaFactor = 1 + event.merma_pct;

  for (const sel of selections) {
    const recipe = sel.recipe;
    const u = units.get(sel.id) ?? 0;
    if (!recipe || recipe.yield_units <= 0 || u <= 0) continue;
    const scale = u / recipe.yield_units;

    for (const item of recipe.items) {
      const ing = item.ingredient;
      if (!ing) continue;
      const qtyBase = convert(item.quantity * scale, item.unit, ing.base_unit);
      if (qtyBase == null) {
        problems.push({
          ingredientName: ing.name,
          reason: `unidad incompatible en "${recipe.name}"`,
        });
        continue;
      }
      const prev = needs.get(ing.id);
      if (prev) prev.baseQty += qtyBase * mermaFactor;
      else needs.set(ing.id, { ingredient: ing, baseQty: qtyBase * mermaFactor });
    }
  }

  // 2) Consolidar por PRODUCTO. Varios ingredientes distintos pueden apuntar al
  //    mismo producto ("Aceite" y "Aceite de oliva" → la misma botella): se
  //    suman ANTES de redondear, para que haya un solo ceil por producto. Si se
  //    redondeara por ingrediente, cada uno pediría su propia botella entera.
  //    La suma se hace en `product.base_unit`, la unidad común de ambos caminos.
  const productNeeds = new Map<string, ProductNeed>();
  const marketNeeds: Need[] = [];

  for (const need of needs.values()) {
    const { ingredient: ing, baseQty } = need;
    const prod = ing.product;

    if (!prod) {
      // Sin producto vinculado: sigue siendo por ingrediente (precio de mercado).
      if (ing.market_price != null) marketNeeds.push(need);
      else problems.push({ ingredientName: ing.name, reason: "sin precio cargado" });
      continue;
    }

    const qty = qtyInProductUnits(ing, prod, baseQty);
    if (qty == null) {
      problems.push({
        ingredientName: ing.name,
        reason: conversionProblem(ing, prod),
      });
      continue;
    }

    const acc = productNeeds.get(prod.id);
    if (acc) {
      acc.productQty += qty;
      acc.ingredients.push(ing);
    } else {
      productNeeds.set(prod.id, {
        product: prod,
        ingredients: [ing],
        productQty: qty,
        threeLayer: isThreeLayer(prod),
      });
    }
  }

  // 3) Convertir necesidades en líneas de compra agrupadas por proveedor.
  //    La clave del grupo es el id del proveedor (o el sentinel MERCADO).
  type GroupAcc = {
    provider: string;
    providerId: string | null;
    phone: string | null;
    lines: MPLine[];
  };
  const groupMap = new Map<string, GroupAcc>();
  const addLine = (
    key: string,
    meta: Omit<GroupAcc, "lines">,
    line: MPLine,
  ) => {
    const g = groupMap.get(key);
    if (g) g.lines.push(line);
    else groupMap.set(key, { ...meta, lines: [line] });
  };

  for (const need of productNeeds.values()) {
    const prod = need.product;
    const provider = prod.provider;
    const providerKey = provider?.id ?? "sin-proveedor";
    const providerMeta = {
      provider: provider?.name ?? "Sin proveedor",
      providerId: provider?.id ?? null,
      phone: provider?.phone ?? null,
    };

    // Una sola línea por producto, con todos sus ingredientes listados.
    const sorted = [...need.ingredients].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const shared = {
      ingredientId: sorted[0].id,
      ingredientIds: sorted.map((i) => i.id),
      ingredientName: sorted.map((i) => i.name).join(" + "),
      productName: prod.name,
      priceIncludesIva: prod.price_includes_iva,
      saleUnit: prod.sale_unit ?? null,
      priceEach: prod.price,
      // Necesidad sin redondear, tal como quedó consolidada. Solo se expone
      // (ver MPLine.neededBaseQty); ningún cálculo de abajo la usa.
      neededBaseQty: need.productQty,
    };

    if (need.threeLayer) {
      // Modelo tres capas: contenido (ml/g) → unidades individuales → packs.
      // `need.productQty` ya viene en unidades individuales (ver qtyInProductUnits).
      const unitsNeeded = Math.max(1, ceilQty(need.productQty));
      const packs = Math.max(1, ceilQty(unitsNeeded / prod.pack_size));
      const purchasedUnits = packs * prod.pack_size;
      const surplusUnits = purchasedUnits - unitsNeeded;
      addLine(providerKey, providerMeta, {
        ...shared,
        buyQty: packs,
        buyUnitLabel:
          prod.sale_unit ??
          (prod.pack_size === 1 ? "un" : `pack ${prod.pack_size} un`),
        totalBaseQty: purchasedUnits,
        baseUnitLabel: "un",
        subtotal: packs * prod.price,
        unitsNeeded,
        unitsPerPack: prod.pack_size,
        surplusUnits: surplusUnits > 0 ? surplusUnits : 0,
      });
    } else {
      // Modelo directo: la cantidad ya está en la unidad base del producto.
      const packs = Math.max(1, ceilQty(need.productQty / prod.pack_size));
      const baseUnitLabel = unitLbl(prod.base_unit);
      addLine(providerKey, providerMeta, {
        ...shared,
        buyQty: packs,
        buyUnitLabel:
          prod.pack_size === 1
            ? baseUnitLabel
            : `pack ${prod.pack_size} ${baseUnitLabel}`,
        totalBaseQty: packs * prod.pack_size,
        baseUnitLabel,
        subtotal: packs * prod.price,
        unitsNeeded: null,
        unitsPerPack: null,
        surplusUnits: null,
      });
    }
  }

  // Ingredientes sin producto: una línea por ingrediente, sin redondeo a packs.
  for (const { ingredient: ing, baseQty } of marketNeeds) {
    const baseUnitLabel = unitLbl(ing.base_unit);
    const qty = Math.round(baseQty * 1000) / 1000;
    addLine(
      MERCADO,
      { provider: MERCADO, providerId: null, phone: null },
      {
        ingredientId: ing.id,
        ingredientIds: [ing.id],
        ingredientName: ing.name,
        productName: null,
        priceIncludesIva: null,
        buyQty: qty,
        buyUnitLabel: baseUnitLabel,
        totalBaseQty: qty,
        baseUnitLabel,
        saleUnit: null,
        priceEach: ing.market_price!,
        subtotal: baseQty * ing.market_price!,
        unitsNeeded: null,
        unitsPerPack: null,
        surplusUnits: null,
        // Sin redondeo a packs: se compra exactamente lo necesario, así que no
        // hay sobrante sistemático en las líneas de precio de mercado.
        neededBaseQty: baseQty,
      },
    );
  }

  const groups: MPGroup[] = [...groupMap.values()]
    .map((g) => ({
      provider: g.provider,
      providerId: g.providerId,
      phone: g.phone,
      lines: g.lines.sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName),
      ),
      subtotal: g.lines.reduce((s, l) => s + l.subtotal, 0),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));

  const total = groups.reduce((s, g) => s + g.subtotal, 0);
  const perPerson = event.pax > 0 ? total / event.pax : 0;

  // Desglose informativo por base de IVA. Solo reparte el total ya calculado.
  const ivaBreakdown: IvaBreakdown = { withIva: 0, withoutIva: 0, unknown: 0 };
  for (const g of groups) {
    for (const l of g.lines) {
      if (l.priceIncludesIva === true) ivaBreakdown.withIva += l.subtotal;
      else if (l.priceIncludesIva === false) ivaBreakdown.withoutIva += l.subtotal;
      else ivaBreakdown.unknown += l.subtotal;
    }
  }

  return { groups, problems, total, perPerson, ivaBreakdown };
}

/**
 * Arma el texto del pedido para un proveedor, listo para copiar/compartir.
 * Cantidades definitivas: ya vienen con merma y redondeo a la unidad de venta.
 */
export function buildProviderOrderMessage(
  eventName: string,
  eventDate: string | null,
  group: MPGroup,
): string {
  // Base de IVA del grupo: si todas las líneas coinciden va como nota al pie;
  // si están mezcladas se aclara línea por línea (y conviene revisar la carga).
  const bases = new Set(group.lines.map((l) => l.priceIncludesIva));
  const mixed = bases.size > 1;
  const ivaTag = (l: MPLine): string => {
    if (!mixed || l.priceIncludesIva == null) return "";
    return l.priceIncludesIva ? " [c/IVA]" : " [s/IVA]";
  };

  const lines = group.lines.map((l) => {
    const saleLabel = l.saleUnit ?? l.buyUnitLabel;
    const packs = `${formatNum(l.buyQty)} ${saleLabel}`;
    // El producto va explícito: una línea puede abastecer varios ingredientes.
    const what = l.productName ?? l.ingredientName;
    // Para modelo tres capas: mostrar unidades reales y cajas por separado.
    if (l.unitsNeeded != null && l.unitsPerPack != null) {
      return `- ${what}: ${formatNum(l.unitsNeeded)} un (${packs})${ivaTag(l)}`;
    }
    const total = `${formatNum(l.totalBaseQty)} ${l.baseUnitLabel}`;
    return `- ${what}: ${total} (${packs})${ivaTag(l)}`;
  });

  const notes: string[] = [];
  if (!mixed) {
    const only = [...bases][0];
    if (only === true) notes.push("Precios de referencia c/IVA.");
    else if (only === false) notes.push("Precios de referencia sin IVA.");
  }

  const dateStr = eventDate ? ` del ${formatDate(eventDate)}` : "";
  return [
    `Hola ${group.provider},`,
    `Te paso el pedido para el evento "${eventName}"${dateStr}:`,
    "",
    ...lines,
    "",
    ...(notes.length > 0 ? [...notes, ""] : []),
    "Quedamos en contacto. Saludos,",
    "Oliva Gastronomía",
  ].join("\n");
}

/**
 * Indica si el sobrante de una línea es lo suficientemente grande como para
 * mostrarlo como alerta informativa (nunca de error).
 * Umbral: sobran más de 1 unidad O el sobrante supera el 30 % de lo comprado.
 */
export function isSurplusSignificant(line: MPLine): boolean {
  if (
    line.surplusUnits == null ||
    line.unitsPerPack == null ||
    line.surplusUnits <= 0
  )
    return false;
  const purchased = line.totalBaseQty; // = packs × pack_size
  return line.surplusUnits > 1 || line.surplusUnits / purchased > 0.3;
}

/** Normaliza un teléfono a solo dígitos para armar el link de wa.me. */
export function whatsappDigits(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}
