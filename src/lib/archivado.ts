import type {
  BarBeverage,
  EventRow,
  IngredientWithProduct,
  LeftoverWithProduct,
  Product,
  RecipeListRow,
} from "@/lib/types";

// =====================================================================
// ARCHIVAR EN VEZ DE BORRAR
//
// "Eliminar" archiva. El elemento desaparece de listados y selectores pero
// sigue existiendo y sigue siendo referenciable por lo que ya lo usaba.
//
// QUÉ HAY QUE CUIDAR, AHORA QUE EL COSTO ESTÁ CONGELADO
// Los eventos FINALIZADOS leen de su foto (migración 0019): archivar no puede
// tocarlos, por construcción. Lo que sí se ve afectado son los eventos
// ACTIVOS, que siguen leyendo del catálogo vivo. Este módulo detecta ese
// impacto para poder avisarlo ANTES de archivar, con nombre y apellido.
// =====================================================================

/** Las cinco entidades archivables. Coincide con la lista blanca de la RPC. */
export type ArchivableEntity =
  | "ingredients"
  | "recipes"
  | "products"
  | "bar_beverages"
  | "leftovers";

export const ENTITY_LABEL: Record<
  ArchivableEntity,
  { singular: string; plural: string }
> = {
  ingredients: { singular: "ingrediente", plural: "ingredientes" },
  recipes: { singular: "receta", plural: "recetas" },
  products: { singular: "producto", plural: "productos" },
  bar_beverages: { singular: "bebida", plural: "bebidas" },
  leftovers: { singular: "sobrante", plural: "sobrantes" },
};

/** Un elemento seleccionado, reducido a lo que necesitan los diálogos. */
export type ArchivableRow = { id: string; name: string };

/** El grafo mínimo para resolver qué evento activo usa qué. */
export type DependencyGraph = {
  /** Eventos con status 'activo'. Los finalizados no participan: leen su foto. */
  activeEvents: EventRow[];
  /** eventId → ids de las recetas elegidas en ese evento. */
  recipesByEvent: Map<string, Set<string>>;
  /** recipeId → ids de los ingredientes que usa. */
  ingredientsByRecipe: Map<string, Set<string>>;
  /** ingredientId → id del producto que lo abastece (si tiene). */
  productByIngredient: Map<string, string>;
};

/** Un evento activo afectado, y por qué. */
export type AffectedEvent = {
  event: EventRow;
  /** Nombres de los elementos seleccionados que este evento usa. */
  via: string[];
};

/** El resultado del análisis: qué se puede archivar y a quién afecta. */
export type ArchiveImpact = {
  entity: ArchivableEntity;
  rows: ArchivableRow[];
  /** Eventos ACTIVOS que usan alguno de los elementos seleccionados. */
  affected: AffectedEvent[];
  /**
   * Elementos que no se pueden archivar, con el motivo. Se calcula ANTES de
   * ejecutar para poder decirlo en el diálogo en vez de fallar a mitad.
   */
  blocked: { row: ArchivableRow; reason: string }[];
  /** Los que efectivamente se van a archivar. */
  archivable: ArchivableRow[];
};

/**
 * Recetas de un evento que usan alguno de los ingredientes dados.
 * Devuelve los nombres de los ingredientes encontrados.
 */
function ingredientsUsedByEvent(
  graph: DependencyGraph,
  eventId: string,
  ingredientIds: Set<string>,
): Set<string> {
  const found = new Set<string>();
  for (const recipeId of graph.recipesByEvent.get(eventId) ?? []) {
    for (const ingId of graph.ingredientsByRecipe.get(recipeId) ?? []) {
      if (ingredientIds.has(ingId)) found.add(ingId);
    }
  }
  return found;
}

/**
 * Calcula el impacto de archivar un conjunto de elementos.
 *
 * `rows` son los seleccionados. `graph` se arma una sola vez por pantalla.
 */
export function computeArchiveImpact(
  entity: ArchivableEntity,
  rows: ArchivableRow[],
  graph: DependencyGraph,
): ArchiveImpact {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ids = new Set(byId.keys());
  const affected: AffectedEvent[] = [];

  const push = (event: EventRow, via: string[]) => {
    if (via.length > 0) affected.push({ event, via });
  };

  for (const event of graph.activeEvents) {
    if (entity === "recipes") {
      const used = [...(graph.recipesByEvent.get(event.id) ?? [])].filter((r) =>
        ids.has(r),
      );
      push(event, used.map((r) => byId.get(r)!.name));
      continue;
    }

    if (entity === "ingredients") {
      const used = ingredientsUsedByEvent(graph, event.id, ids);
      push(event, [...used].map((i) => byId.get(i)!.name));
      continue;
    }

    if (entity === "products") {
      // Un producto llega al evento a través de los ingredientes que abastece.
      const viaProducts = new Set<string>();
      for (const recipeId of graph.recipesByEvent.get(event.id) ?? []) {
        for (const ingId of graph.ingredientsByRecipe.get(recipeId) ?? []) {
          const prodId = graph.productByIngredient.get(ingId);
          if (prodId && ids.has(prodId)) viaProducts.add(prodId);
        }
      }
      push(event, [...viaProducts].map((p) => byId.get(p)!.name));
      continue;
    }

    if (entity === "bar_beverages") {
      // Las bebidas NO tienen FK con los eventos: `computeBarra` filtra el
      // catálogo global por el servicio del evento en cada render. Así que
      // "usa esta bebida" se decide por el servicio, no por una referencia.
      if (event.barra_service === "ninguna") continue;
      const used = rows.filter((r) => {
        const service = (r as ArchivableRow & { service?: string }).service;
        return service === event.barra_service || service === "ambos";
      });
      push(event, used.map((r) => r.name));
      continue;
    }

    // leftovers: nadie los referencia y no entran en ningún costeo (Etapa 1).
  }

  // Hoy nada bloquea el archivado: archivar es siempre posible porque no toca
  // ninguna FK. El campo existe igual porque el diálogo promete avisar antes
  // de fallar, y porque el borrado definitivo sí tiene motivos de bloqueo.
  const blocked: ArchiveImpact["blocked"] = [];

  return { entity, rows, affected, blocked, archivable: rows };
}

/** Un motivo por el que un elemento archivado no se puede borrar del todo. */
export type DeleteBlock = { row: ArchivableRow; reason: string };

/**
 * Qué elementos archivados se pueden borrar de verdad y cuáles no.
 *
 * Espeja las condiciones de `delete_archived_rows` (migración 0020). La base
 * es la que manda —el front no puede saltearse el chequeo aunque quiera—,
 * pero calcularlo también acá permite decirlo en el diálogo en vez de que la
 * operación devuelva "borré 3 de 8" sin explicar cuáles.
 */
export type DeletePlan = {
  deletable: ArchivableRow[];
  blocked: DeleteBlock[];
};

export function computeDeletePlan(
  entity: ArchivableEntity,
  rows: ArchivableRow[],
  refs: {
    /** ingredientId → cuántas recetas lo usan. */
    recipesByIngredient?: Map<string, number>;
    /** recipeId → en cuántos eventos (de cualquier estado) está elegida. */
    eventsByRecipe?: Map<string, number>;
    /** productId → cuántos ingredientes lo tienen vinculado. */
    ingredientsByProduct?: Map<string, number>;
    /** productId → cuántos sobrantes salieron de él. */
    leftoversByProduct?: Map<string, number>;
  },
): DeletePlan {
  const deletable: ArchivableRow[] = [];
  const blocked: DeleteBlock[] = [];

  for (const row of rows) {
    let reason: string | null = null;

    if (entity === "ingredients") {
      const n = refs.recipesByIngredient?.get(row.id) ?? 0;
      if (n > 0) reason = `se usa en ${n} receta${n === 1 ? "" : "s"}`;
    } else if (entity === "recipes") {
      const n = refs.eventsByRecipe?.get(row.id) ?? 0;
      if (n > 0) reason = `está en el menú de ${n} evento${n === 1 ? "" : "s"}`;
    } else if (entity === "products") {
      const ing = refs.ingredientsByProduct?.get(row.id) ?? 0;
      const lef = refs.leftoversByProduct?.get(row.id) ?? 0;
      const partes: string[] = [];
      if (ing > 0) partes.push(`${ing} ingrediente${ing === 1 ? "" : "s"} lo usa${ing === 1 ? "" : "n"}`);
      if (lef > 0) partes.push(`${lef} sobrante${lef === 1 ? "" : "s"} salió de él`);
      if (partes.length > 0) reason = partes.join(" y ");
    }
    // bar_beverages y leftovers: nada los referencia, siempre borrables.

    if (reason) blocked.push({ row, reason });
    else deletable.push(row);
  }

  return { deletable, blocked };
}

/**
 * Lista legible de nombres: los primeros `max` y "y N más".
 * La usan los diálogos para no volverse ilegibles con 40 elementos.
 */
export function nameList(rows: ArchivableRow[], max = 8): string {
  const names = rows.map((r) => r.name);
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} y ${names.length - max} más`;
}

/** Arriba de este número, archivar pide una confirmación más fuerte. */
export const BULK_CONFIRM_THRESHOLD = 10;

// ---------------------------------------------------------------------
// Construcción del grafo a partir de lo que ya cargan las pantallas
// ---------------------------------------------------------------------

/** Recetas con sus ítems, tal como las devuelve `listRecipesWithItems`. */
export type RecipeGraphRow = {
  id: string;
  items: { ingredient_id: string }[];
};

/** Evento con sus recetas, tal como las devuelve `listEventRecipeLinks`. */
export type EventRecipeLink = { event_id: string; recipe_id: string };

export function buildDependencyGraph(params: {
  events: EventRow[];
  eventRecipes: EventRecipeLink[];
  recipes: RecipeGraphRow[];
  ingredients: Pick<IngredientWithProduct, "id" | "product_id">[];
}): DependencyGraph {
  const activeEvents = params.events.filter((e) => e.status === "activo");
  const activeIds = new Set(activeEvents.map((e) => e.id));

  const recipesByEvent = new Map<string, Set<string>>();
  for (const link of params.eventRecipes) {
    if (!activeIds.has(link.event_id)) continue;
    const set = recipesByEvent.get(link.event_id) ?? new Set<string>();
    set.add(link.recipe_id);
    recipesByEvent.set(link.event_id, set);
  }

  const ingredientsByRecipe = new Map<string, Set<string>>();
  for (const r of params.recipes) {
    ingredientsByRecipe.set(
      r.id,
      new Set(r.items.map((i) => i.ingredient_id)),
    );
  }

  const productByIngredient = new Map<string, string>();
  for (const ing of params.ingredients) {
    if (ing.product_id) productByIngredient.set(ing.id, ing.product_id);
  }

  return { activeEvents, recipesByEvent, ingredientsByRecipe, productByIngredient };
}

// ---------------------------------------------------------------------
// Adaptadores: cada pantalla convierte sus filas a `ArchivableRow`
// ---------------------------------------------------------------------

export const toRow = {
  ingredient: (i: IngredientWithProduct): ArchivableRow => ({
    id: i.id,
    name: i.name,
  }),
  recipe: (r: RecipeListRow): ArchivableRow => ({ id: r.id, name: r.name }),
  product: (p: Product): ArchivableRow => ({ id: p.id, name: p.name }),
  // El servicio viaja con la fila: es lo que decide a qué eventos alcanza.
  beverage: (b: BarBeverage): ArchivableRow & { service: string } => ({
    id: b.id,
    name: b.name,
    service: b.service,
  }),
  leftover: (l: LeftoverWithProduct): ArchivableRow => ({
    id: l.id,
    name: l.product?.name ?? "sobrante",
  }),
};
