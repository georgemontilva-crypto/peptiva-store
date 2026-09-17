import {
  mysqlTable, int, varchar, text, mediumtext, decimal, boolean, timestamp, json, mysqlEnum, primaryKey, index, date,
} from "drizzle-orm/mysql-core";

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 191 }).notNull(),
  description: text("description"),
  sortOrder: int("sort_order").notNull().default(0),
});

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 191 }).notNull().unique(),
    name: varchar("name", { length: 191 }).notNull(),
    shortDescription: text("short_description"),
    descriptionHtml: mediumtext("description_html"),
    /** Precio base; en productos con variantes es el de la variante más barata. */
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
    imageUrl: varchar("image_url", { length: 1024 }),
    gallery: json("gallery").$type<string[]>(),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: varchar("seo_description", { length: 512 }),
    status: mysqlEnum("status", ["active", "draft"]).notNull().default("active"),
    stockStatus: mysqlEnum("stock_status", ["instock", "outofstock"]).notNull().default("instock"),
    featured: boolean("featured").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
    /** ID del producto en WooCommerce, para trazabilidad de la migración. */
    wpId: int("wp_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("products_status_idx").on(t.status)],
);

export const productCategories = mysqlTable(
  "product_categories",
  {
    productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    categoryId: int("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const productVariants = mysqlTable(
  "product_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 64 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
    sku: varchar("sku", { length: 64 }),
    stockStatus: mysqlEnum("stock_status", ["instock", "outofstock"]).notNull().default("instock"),
    sortOrder: int("sort_order").notNull().default(0),
    wpId: int("wp_id"),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

/** Certificados de análisis por lote (COAs). */
export const coaLots = mysqlTable(
  "coa_lots",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    lotNumber: varchar("lot_number", { length: 64 }).notNull(),
    purity: varchar("purity", { length: 32 }),
    lab: varchar("lab", { length: 191 }),
    testedAt: date("tested_at", { mode: "string" }),
    reportUrl: varchar("report_url", { length: 1024 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("coa_product_idx").on(t.productId)],
);
