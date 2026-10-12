import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "published",
  "archived",
]);

export const variantStatusEnum = pgEnum("variant_status", [
  "active",
  "archived",
]);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "adjustment",
  "reservation",
  "release",
  "sale",
  "return",
]);

export const categoriesTable = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    description: text("description"),
    imagePath: text("image_path"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("categories_slug_uidx").on(table.slug),
    index("categories_active_sort_idx").on(table.isActive, table.sortOrder),
  ],
);

export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => categoriesTable.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    shortDescription: varchar("short_description", { length: 280 }),
    description: text("description"),
    status: productStatusEnum("status").notNull().default("draft"),
    brand: varchar("brand", { length: 120 }),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("products_slug_uidx").on(table.slug),
    index("products_status_created_idx").on(table.status, table.createdAt),
    index("products_category_status_idx").on(table.categoryId, table.status),
  ],
);

export const productImagesTable = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    altText: varchar("alt_text", { length: 300 }).notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("product_images_product_order_idx").on(table.productId, table.sortOrder),
  ],
);

export const productVariantsTable = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    options: jsonb("options")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    priceMinor: integer("price_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    compareAtPriceMinor: integer("compare_at_price_minor"),
    status: variantStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("product_variants_sku_uidx").on(table.sku),
    index("product_variants_product_status_idx").on(
      table.productId,
      table.status,
    ),
    check(
      "product_variants_price_nonnegative_check",
      sql`${table.priceMinor} >= 0`,
    ),
    check(
      "product_variants_compare_at_nonnegative_check",
      sql`${table.compareAtPriceMinor} IS NULL OR ${table.compareAtPriceMinor} >= 0`,
    ),
  ],
);

export const inventoryLocationsTable = pgTable(
  "inventory_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 60 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("inventory_locations_code_uidx").on(table.code)],
);

export const inventoryTable = pgTable(
  "inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocationsTable.id, { onDelete: "restrict" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("inventory_variant_location_uidx").on(
      table.variantId,
      table.locationId,
    ),
    check("inventory_on_hand_nonnegative_check", sql`${table.onHand} >= 0`),
    check("inventory_reserved_nonnegative_check", sql`${table.reserved} >= 0`),
    check(
      "inventory_reserved_not_above_on_hand_check",
      sql`${table.reserved} <= ${table.onHand}`,
    ),
  ],
);

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocationsTable.id, { onDelete: "restrict" }),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_movements_variant_created_idx").on(
      table.variantId,
      table.createdAt,
    ),
  ],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: varchar("actor_user_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 160 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("audit_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt)],
);

export const productRelations = relations(productsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.categoryId],
    references: [categoriesTable.id],
  }),
  images: many(productImagesTable),
  variants: many(productVariantsTable),
}));

export const categoryRelations = relations(categoriesTable, ({ many }) => ({
  products: many(productsTable),
}));

export const variantRelations = relations(
  productVariantsTable,
  ({ one, many }) => ({
    product: one(productsTable, {
      fields: [productVariantsTable.productId],
      references: [productsTable.id],
    }),
    inventory: many(inventoryTable),
  }),
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});
export const insertProductImageSchema = createInsertSchema(
  productImagesTable,
).omit({ id: true, createdAt: true });
export const insertProductVariantSchema = createInsertSchema(
  productVariantsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductStatus = (typeof productStatusEnum.enumValues)[number];
export type VariantStatus = (typeof variantStatusEnum.enumValues)[number];
export type InventoryMovementType =
  (typeof inventoryMovementTypeEnum.enumValues)[number];
