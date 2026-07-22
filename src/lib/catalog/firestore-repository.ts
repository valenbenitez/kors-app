import {
  type EditorialTipo,
  editorialDocId,
  isEditorialTipo,
  payloadSchemaByTipo,
} from "@/lib/catalog/parse-editorial";
import type { CatalogRepository } from "@/lib/catalog/repository";
import { catalogExcursionSchema } from "@/lib/catalog/schemas";
import { CatalogQueryError } from "@/lib/catalog/static-repository";
import type {
  CatalogQuery,
  CatalogResponse,
  CatalogTipo,
} from "@/lib/catalog/types";
import {
  type CatalogExcursion,
  filterExcursionList,
} from "@/lib/cotizador/catalog";
import { provinceToCatalogDestino } from "@/lib/cotizador/provinces";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  CATALOG_EDITORIAL,
  CATALOG_EXCURSIONS,
} from "@/lib/firebase/collections";

/**
 * Firestore-backed catalog reads. Documents must have been synced via
 * `POST /api/admin/sync-catalog` (Sheet CSV or static seed).
 */
export class FirestoreCatalogRepository implements CatalogRepository {
  async get(tipo: CatalogTipo, query: CatalogQuery): Promise<CatalogResponse> {
    switch (tipo) {
      case "excursiones":
        return this.excursiones(query);
      case "tips":
        return this.listEditorial("tips", query);
      case "gastro":
        return this.listEditorial("gastro", query);
      case "packing":
        return this.packing(query);
      case "mapas":
        return this.mapas(query);
      case "clima":
        return this.clima(query);
      case "hero_tags":
        return this.listEditorial("hero_tags", query);
    }
  }

  private requireDestino(query: CatalogQuery): string {
    const destino = query.destino?.trim();
    if (!destino) {
      throw new CatalogQueryError("destino is required");
    }
    return destino;
  }

  private resolveCatalogKey(selection: string): string {
    return provinceToCatalogDestino(selection) ?? selection;
  }

  private async excursiones(query: CatalogQuery): Promise<CatalogResponse> {
    const destino = this.requireDestino(query);
    const fechaIda = query.fechaIda?.trim();
    if (!fechaIda) {
      throw new CatalogQueryError("fechaIda is required for excursiones");
    }

    const catalogDestino = provinceToCatalogDestino(destino);
    if (!catalogDestino) {
      return { items: [] };
    }

    const snap = await getAdminFirestore()
      .collection(CATALOG_EXCURSIONS)
      .where("destino", "==", catalogDestino)
      .get();

    const items: CatalogExcursion[] = [];
    for (const doc of snap.docs) {
      const parsed = catalogExcursionSchema.safeParse(doc.data());
      if (parsed.success) {
        items.push(parsed.data);
      }
    }

    return {
      items: filterExcursionList(items, {
        destino: catalogDestino,
        fechaIda,
        query: query.query,
      }),
    };
  }

  private async listEditorial(
    tipo: "tips" | "gastro" | "hero_tags",
    query: CatalogQuery,
  ): Promise<CatalogResponse> {
    const destino = this.resolveCatalogKey(this.requireDestino(query));
    const payload = await this.readEditorialPayload(destino, tipo);
    if (payload === undefined) {
      return { items: [] };
    }
    return { items: payload as never };
  }

  private async packing(query: CatalogQuery): Promise<CatalogResponse> {
    const destino = this.resolveCatalogKey(this.requireDestino(query));
    const payload = await this.readEditorialPayload(destino, "packing");
    if (payload === undefined) {
      return { title: "", items: [] };
    }
    return payload as { title: string; items: never[] };
  }

  private async mapas(query: CatalogQuery): Promise<CatalogResponse> {
    const destino = this.resolveCatalogKey(this.requireDestino(query));
    const payload = await this.readEditorialPayload(destino, "mapas");
    if (payload === undefined) {
      return { item: null };
    }
    return { item: payload as never };
  }

  private async clima(query: CatalogQuery): Promise<CatalogResponse> {
    const destino = this.resolveCatalogKey(this.requireDestino(query));
    const mes = query.mes ?? null;
    const payload = await this.readEditorialPayload(destino, "clima");
    if (payload === undefined) {
      return { item: null, mes };
    }
    return { item: payload as never, mes };
  }

  private async readEditorialPayload(
    destino: string,
    tipo: EditorialTipo,
  ): Promise<unknown | undefined> {
    if (!isEditorialTipo(tipo)) return undefined;

    const id = editorialDocId(destino, tipo);
    const snap = await getAdminFirestore()
      .collection(CATALOG_EDITORIAL)
      .doc(id)
      .get();

    if (!snap.exists) return undefined;

    const data = snap.data();
    if (!data || data.payload === undefined) return undefined;

    const parsed = payloadSchemaByTipo[tipo].safeParse(data.payload);
    if (!parsed.success) return undefined;
    return parsed.data;
  }
}
