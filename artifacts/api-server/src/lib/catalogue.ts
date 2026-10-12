import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod/v4";
import {
  auditLogsTable,
  categoriesTable,
  db,
  inventoryLocationsTable,
  inventoryMovementsTable,
  inventoryTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
} from "@workspace/db";
import {
  CreateProductBody,
  GetAdminSummaryResponse,
  GetProductResponse,
  ListAdminProductsQueryParams,
  ListAdminProductsResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateProductBody,
} from "@workspace/api-zod";

type AdminProduct = z.infer<typeof ListAdminProductsResponse>[number];
type AdminSummary = z.infer<typeof GetAdminSummaryResponse>;
type Product = z.infer<typeof GetProductResponse>;
type ProductImage = Product["images"][number];
type ProductSearchResult = z.infer<typeof ListProductsResponse>;
type ProductSummary = ProductSearchResult["products"][number];
type CreateProductInput = z.infer<typeof CreateProductBody>;
type UpdateProductInput = z.infer<typeof UpdateProductBody>;
type AdminListQuery = z.infer<typeof ListAdminProductsQueryParams>;
type ProductListQuery = z.infer<typeof ListProductsQueryParams>;

export class CatalogueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueValidationError";
  }
}

function publicImageUrl(path: string): boolean {
  return (
    path.startsWith("/api/storage/public-objects/") ||
    /^https:\/\//i.test(path)
  );
}

function validateProductContent(
  images: Array<{ path: string; isPrimary: boolean }>,
  variants: Array<{ currency: string }>,
): void {
  if (images.some((image) => !publicImageUrl(image.path))) {
    throw new CatalogueValidationError(
      "Images must use HTTPS URLs or public VYRO App Storage paths.",
    );
  }

  if (images.length > 0 && images.filter((image) => image.isPrimary).length !== 1) {
    throw new CatalogueValidationError(
      "Choose exactly one primary image when product images are provided.",
    );
  }

  if (variants.some((variant) => !/^[A-Z]{3}$/.test(variant.currency))) {
    throw new CatalogueValidationError(
      "Currency must be a three-letter uppercase ISO currency code.",
    );
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function getDefaultLocation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx
    .insert(inventoryLocationsTable)
    .values({ name: "Primary", code: "primary" })
    .onConflictDoNothing({ target: inventoryLocationsTable.code });

  const [location] = await tx
    .select()
    .from(inventoryLocationsTable)
    .where(eq(inventoryLocationsTable.code, "primary"))
    .limit(1);

  if (!location) {
    throw new Error("Unable to initialize the primary inventory location.");
  }

  return location;
}

async function writeInventory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  variantId: string,
  locationId: string,
  stockOnHand: number,
  actorUserId: string,
  reason: string,
): Promise<void> {
  const [current] = await tx
    .select()
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.variantId, variantId),
        eq(inventoryTable.locationId, locationId),
      ),
    )
    .limit(1);

  const previousQuantity = current?.onHand ?? 0;
  const delta = stockOnHand - previousQuantity;

  if (current && stockOnHand < current.reserved) {
    throw new CatalogueValidationError(
      "Stock cannot be reduced below the quantity already reserved.",
    );
  }

  if (current) {
    await tx
      .update(inventoryTable)
      .set({ onHand: stockOnHand })
      .where(eq(inventoryTable.id, current.id));
  } else {
    await tx.insert(inventoryTable).values({
      variantId,
      locationId,
      onHand: stockOnHand,
      reserved: 0,
    });
  }

  if (delta !== 0) {
    await tx.insert(inventoryMovementsTable).values({
      variantId,
      locationId,
      movementType: "adjustment",
      quantityDelta: delta,
      reason,
      actorUserId,
    });
  }
}

async function replaceImages(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  images: CreateProductInput["images"],
): Promise<void> {
  await tx
    .delete(productImagesTable)
    .where(eq(productImagesTable.productId, productId));

  if (images.length > 0) {
    await tx.insert(productImagesTable).values(
      images.map((image) => ({
        productId,
        path: image.path,
        altText: image.altText,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      })),
    );
  }
}

async function replaceVariants(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  variants: CreateProductInput["variants"],
  actorUserId: string,
): Promise<void> {
  const location = await getDefaultLocation(tx);
  const existingVariants = await tx
    .select()
    .from(productVariantsTable)
    .where(
      and(
        eq(productVariantsTable.productId, productId),
        eq(productVariantsTable.status, "active"),
      ),
    );
  const bySku = new Map(existingVariants.map((variant) => [variant.sku, variant]));
  const retainedSkus = new Set(variants.map((variant) => variant.sku));

  for (const input of variants) {
    const existing = bySku.get(input.sku);
    if (existing) {
      await tx
        .update(productVariantsTable)
        .set({
          name: input.name,
          options: input.options,
          priceMinor: input.priceMinor,
          currency: input.currency,
          compareAtPriceMinor: input.compareAtPriceMinor,
          status: "active",
        })
        .where(eq(productVariantsTable.id, existing.id));
      await writeInventory(
        tx,
        existing.id,
        location.id,
        input.stockOnHand,
        actorUserId,
        "Administrator updated product stock.",
      );
    } else {
      const [created] = await tx
        .insert(productVariantsTable)
        .values({
          productId,
          sku: input.sku,
          name: input.name,
          options: input.options,
          priceMinor: input.priceMinor,
          currency: input.currency,
          compareAtPriceMinor: input.compareAtPriceMinor,
          status: "active",
        })
        .returning();
      await writeInventory(
        tx,
        created.id,
        location.id,
        input.stockOnHand,
        actorUserId,
        "Administrator added a product variant.",
      );
    }
  }

  const removedIds = existingVariants
    .filter((variant) => !retainedSkus.has(variant.sku))
    .map((variant) => variant.id);

  if (removedIds.length > 0) {
    await tx
      .update(productVariantsTable)
      .set({ status: "archived" })
      .where(inArray(productVariantsTable.id, removedIds));
  }
}

function imageForApi(image: typeof productImagesTable.$inferSelect): ProductImage {
  return {
    id: image.id,
    path: image.path,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
  };
}

const inventoryTotals = db
  .select({
    variantId: inventoryTable.variantId,
    onHand: sql<number>`COALESCE(SUM(${inventoryTable.onHand}), 0)::int`.as(
      "on_hand",
    ),
    reserved: sql<number>`COALESCE(SUM(${inventoryTable.reserved}), 0)::int`.as(
      "reserved",
    ),
  })
  .from(inventoryTable)
  .groupBy(inventoryTable.variantId)
  .as("inventory_totals");

async function variantsForProducts(productIds: string[]) {
  if (productIds.length === 0) return [];

  return db
    .select({
      variant: productVariantsTable,
      stockOnHand: sql<number>`COALESCE(${inventoryTotals.onHand}, 0)::int`,
      reserved: sql<number>`COALESCE(${inventoryTotals.reserved}, 0)::int`,
    })
    .from(productVariantsTable)
    .leftJoin(
      inventoryTotals,
      eq(inventoryTotals.variantId, productVariantsTable.id),
    )
    .where(
      and(
        inArray(productVariantsTable.productId, productIds),
        eq(productVariantsTable.status, "active"),
      ),
    )
    .orderBy(asc(productVariantsTable.name));
}

function filtersForProducts(params: ProductListQuery): SQL[] {
  const filters: SQL[] = [eq(productsTable.status, "published")];
  if (params.category) {
    filters.push(eq(categoriesTable.slug, params.category));
  }
  if (params.featured !== undefined) {
    filters.push(eq(productsTable.featured, params.featured));
  }
  if (params.q?.trim()) {
    const query = `%${escapeLike(params.q.trim())}%`;
    const matches = or(
      ilike(productsTable.name, query),
      ilike(productsTable.shortDescription, query),
      ilike(productsTable.description, query),
      ilike(productsTable.brand, query),
    );
    if (matches) filters.push(matches);
  }
  return filters;
}

export async function listCategories() {
  const rows = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.isActive, true))
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));

  return rows.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imagePath: category.imagePath,
    sortOrder: category.sortOrder,
  }));
}

export async function listProducts(
  params: ProductListQuery,
): Promise<ProductSearchResult> {
  const filters = filtersForProducts(params);
  const [countRow] = await db
    .select({ total: count() })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...filters));

  const minPrices = db
    .select({
      productId: productVariantsTable.productId,
      minPrice: sql<number>`MIN(${productVariantsTable.priceMinor})`.as(
        "min_price",
      ),
    })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.status, "active"))
    .groupBy(productVariantsTable.productId)
    .as("variant_min_prices");

  const sort = params.sort ?? "newest";
  const orderBy =
    sort === "name"
      ? [asc(productsTable.name)]
      : sort === "price-asc"
        ? [asc(minPrices.minPrice), asc(productsTable.name)]
        : sort === "price-desc"
          ? [desc(minPrices.minPrice), asc(productsTable.name)]
          : [desc(productsTable.createdAt)];

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 12;
  const productRows = await db
    .select({
      product: productsTable,
      category: categoriesTable,
      minPrice: minPrices.minPrice,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(minPrices, eq(minPrices.productId, productsTable.id))
    .where(and(...filters))
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const productIds = productRows.map((row) => row.product.id);
  const [images, variants] = await Promise.all([
    productIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(productImagesTable)
          .where(inArray(productImagesTable.productId, productIds))
          .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder)),
    variantsForProducts(productIds),
  ]);

  const imagesByProduct = new Map<string, ProductImage[]>();
  for (const image of images) {
    const productImages = imagesByProduct.get(image.productId) ?? [];
    productImages.push(imageForApi(image));
    imagesByProduct.set(image.productId, productImages);
  }

  const variantsByProduct = new Map<
    string,
    Array<{ priceMinor: number; currency: string; available: boolean }>
  >();
  for (const row of variants) {
    const productVariants = variantsByProduct.get(row.variant.productId) ?? [];
    productVariants.push({
      priceMinor: row.variant.priceMinor,
      currency: row.variant.currency,
      available: row.stockOnHand > row.reserved,
    });
    variantsByProduct.set(row.variant.productId, productVariants);
  }

  const summaries: ProductSummary[] = productRows.flatMap((row) => {
    const productImages = imagesByProduct.get(row.product.id) ?? [];
    const productVariants = variantsByProduct.get(row.product.id) ?? [];
    const primaryImage = productImages.find((image) => image.isPrimary);
    const lowestPrice = productVariants.reduce(
      (lowest, variant) => (variant.priceMinor < lowest.priceMinor ? variant : lowest),
      productVariants[0],
    );

    if (!primaryImage || !lowestPrice) return [];

    return [{
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      shortDescription: row.product.shortDescription,
      categoryName: row.category?.name ?? null,
      featured: row.product.featured,
      primaryImage,
      priceMinor: lowestPrice.priceMinor,
      currency: lowestPrice.currency,
      available: productVariants.some((variant) => variant.available),
    }];
  });

  return {
    products: summaries,
    total: countRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getPublishedProduct(slug: string): Promise<Product | null> {
  const [row] = await db
    .select({ product: productsTable, category: categoriesTable })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(productsTable.slug, slug),
        eq(productsTable.status, "published"),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [images, variants] = await Promise.all([
    db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, row.product.id))
      .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder)),
    variantsForProducts([row.product.id]),
  ]);

  return {
    id: row.product.id,
    name: row.product.name,
    slug: row.product.slug,
    shortDescription: row.product.shortDescription,
    description: row.product.description,
    brand: row.product.brand,
    featured: row.product.featured,
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          slug: row.category.slug,
          description: row.category.description,
          imagePath: row.category.imagePath,
          sortOrder: row.category.sortOrder,
        }
      : null,
    images: images.map(imageForApi),
    variants: variants.map(({ variant, stockOnHand, reserved }) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      options: variant.options,
      priceMinor: variant.priceMinor,
      currency: variant.currency,
      compareAtPriceMinor: variant.compareAtPriceMinor,
      available: stockOnHand > reserved,
    })),
    createdAt: row.product.createdAt.toISOString(),
  };
}

async function loadAdminProduct(id: string): Promise<AdminProduct | null> {
  const [row] = await db
    .select({ product: productsTable, category: categoriesTable })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id))
    .limit(1);
  if (!row) return null;

  const [images, variants] = await Promise.all([
    db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, row.product.id))
      .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder)),
    variantsForProducts([row.product.id]),
  ]);

  return {
    id: row.product.id,
    categoryId: row.product.categoryId,
    categoryName: row.category?.name ?? null,
    name: row.product.name,
    slug: row.product.slug,
    shortDescription: row.product.shortDescription,
    description: row.product.description,
    status: row.product.status,
    brand: row.product.brand,
    featured: row.product.featured,
    images: images.map(imageForApi),
    variants: variants.map(({ variant, stockOnHand, reserved }) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      options: variant.options,
      priceMinor: variant.priceMinor,
      currency: variant.currency,
      compareAtPriceMinor: variant.compareAtPriceMinor,
      stockOnHand,
      reserved,
    })),
    createdAt: row.product.createdAt.toISOString(),
    updatedAt: row.product.updatedAt.toISOString(),
  };
}

export async function listAdminProducts(
  params: AdminListQuery,
): Promise<AdminProduct[]> {
  const filters: SQL[] = [];
  if (params.status) {
    filters.push(eq(productsTable.status, params.status));
  }
  if (params.q?.trim()) {
    const query = `%${escapeLike(params.q.trim())}%`;
    const matches = or(
      ilike(productsTable.name, query),
      ilike(productsTable.slug, query),
      ilike(productsTable.brand, query),
    );
    if (matches) filters.push(matches);
  }

  const rows = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(productsTable.updatedAt));

  const products = await Promise.all(rows.map((row) => loadAdminProduct(row.id)));
  return products.filter((product): product is AdminProduct => product !== null);
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const counts = await db
    .select({ status: productsTable.status, total: count() })
    .from(productsTable)
    .groupBy(productsTable.status);
  const byStatus = new Map(counts.map((row) => [row.status, row.total]));
  const [stockRow] = await db
    .select({
      outOfStock: sql<number>`COUNT(*)::int`,
    })
    .from(
      db
        .select({ variantId: inventoryTotals.variantId })
        .from(inventoryTotals)
        .where(sql`${inventoryTotals.onHand} <= ${inventoryTotals.reserved}`)
        .as("out_of_stock_variants"),
    );

  return {
    totalProducts: counts.reduce((total, row) => total + row.total, 0),
    publishedProducts: byStatus.get("published") ?? 0,
    draftProducts: byStatus.get("draft") ?? 0,
    archivedProducts: byStatus.get("archived") ?? 0,
    outOfStockVariants: stockRow?.outOfStock ?? 0,
  };
}

export async function createProduct(
  input: CreateProductInput,
  actorUserId: string,
): Promise<AdminProduct> {
  validateProductContent(input.images, input.variants);
  if (input.status === "published" && input.images.length === 0) {
    throw new CatalogueValidationError(
      "Add at least one product image before publishing.",
    );
  }
  const createdId = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(productsTable)
      .values({
        categoryId: input.categoryId ?? null,
        name: input.name.trim(),
        slug: input.slug.trim(),
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        status: input.status,
        brand: input.brand ?? null,
        featured: input.featured,
        publishedAt: input.status === "published" ? new Date() : null,
      })
      .returning();

    await replaceImages(tx, product.id, input.images);
    await replaceVariants(tx, product.id, input.variants, actorUserId);
    await tx.insert(auditLogsTable).values({
      actorUserId,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      changes: { status: product.status, slug: product.slug },
    });

    return product.id;
  });

  const product = await loadAdminProduct(createdId);
  if (!product) throw new Error("Created product could not be loaded.");
  return product;
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  actorUserId: string,
): Promise<AdminProduct | null> {
  if (Object.keys(input).length === 0) {
    throw new CatalogueValidationError("Provide at least one field to update.");
  }

  const updated = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);
    if (!current) return false;

    const fields: Partial<typeof productsTable.$inferInsert> = {};
    if (input.categoryId !== undefined) fields.categoryId = input.categoryId;
    if (input.name !== undefined) fields.name = input.name.trim();
    if (input.slug !== undefined) fields.slug = input.slug.trim();
    if (input.shortDescription !== undefined) {
      fields.shortDescription = input.shortDescription;
    }
    if (input.description !== undefined) fields.description = input.description;
    if (input.brand !== undefined) fields.brand = input.brand;
    if (input.featured !== undefined) fields.featured = input.featured;
    if (input.status !== undefined) {
      fields.status = input.status;
      fields.publishedAt =
        input.status === "published"
          ? current.publishedAt ?? new Date()
          : null;
    }

    if (Object.keys(fields).length > 0) {
      await tx
        .update(productsTable)
        .set(fields)
        .where(eq(productsTable.id, id));
    }

    if (input.images !== undefined) {
      validateProductContent(input.images, []);
      await replaceImages(tx, id, input.images);
    }

    if (input.variants !== undefined) {
      validateProductContent([], input.variants);
      await replaceVariants(tx, id, input.variants, actorUserId);
    }

    if ((input.status ?? current.status) === "published") {
      const [imageRow] = await tx
        .select({ total: count() })
        .from(productImagesTable)
        .where(
          and(
            eq(productImagesTable.productId, id),
            eq(productImagesTable.isPrimary, true),
          ),
        );
      const [variantRow] = await tx
        .select({ total: count() })
        .from(productVariantsTable)
        .where(
          and(
            eq(productVariantsTable.productId, id),
            eq(productVariantsTable.status, "active"),
          ),
        );
      if (!imageRow?.total || !variantRow?.total) {
        throw new CatalogueValidationError(
          "A published product needs a primary image and at least one active variant.",
        );
      }
    }

    await tx.insert(auditLogsTable).values({
      actorUserId,
      action: "product.updated",
      entityType: "product",
      entityId: id,
      changes: { fields: Object.keys(input) },
    });

    return true;
  });

  if (!updated) return null;
  return loadAdminProduct(id);
}

export function isUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23505") return true;
  return candidate.cause ? isUniqueConflict(candidate.cause) : false;
}

export function isValidationError(
  error: unknown,
): error is CatalogueValidationError {
  return error instanceof CatalogueValidationError;
}
