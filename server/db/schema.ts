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

export const orderStatuses = [
  "pending", // creado, esperando pago en Bankful
  "paid", // pago aprobado con firma verificada
  "on_hold", // requiere revisión manual (firma inválida, monto distinto, pago pendiente)
  "failed",
  "cancelled",
  "shipped",
  "completed",
  "refunded",
] as const;

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Token aleatorio para ver la confirmación sin cuenta. */
    accessKey: varchar("access_key", { length: 64 }).notNull(),
    status: mysqlEnum("status", orderStatuses).notNull().default("pending"),
    email: varchar("email", { length: 191 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    address1: varchar("address1", { length: 200 }).notNull(),
    address2: varchar("address2", { length: 200 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    zip: varchar("zip", { length: 20 }).notNull(),
    country: varchar("country", { length: 2 }).notNull().default("US"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    bundleDiscount: decimal("bundle_discount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    couponCode: varchar("coupon_code", { length: 64 }),
    couponDiscount: decimal("coupon_discount", { precision: 10, scale: 2 }).notNull().default("0.00"),
    shippingTotal: decimal("shipping_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    customerNote: text("customer_note"),
    researchAcknowledged: boolean("research_acknowledged").notNull().default(false),
    paymentTransactionId: varchar("payment_transaction_id", { length: 128 }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("orders_email_idx").on(t.email), index("orders_status_idx").on(t.status)],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: int("product_id"),
    variantId: int("variant_id"),
    name: varchar("name", { length: 191 }).notNull(),
    variantLabel: varchar("variant_label", { length: 64 }),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
    bundlePercent: int("bundle_percent").notNull().default(0),
    lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/** Registro de cada llamada de Bankful (auditoría e idempotencia). */
export const paymentEvents = mysqlTable(
  "payment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id"),
    kind: varchar("kind", { length: 32 }),
    transStatus: varchar("trans_status", { length: 32 }),
    transactionId: varchar("transaction_id", { length: 128 }),
    signatureValid: boolean("signature_valid").notNull(),
    outcome: varchar("outcome", { length: 64 }).notNull(),
    payload: json("payload").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("payment_events_order_idx").on(t.orderId)],
);

export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  /** Siempre en minúsculas. */
  code: varchar("code", { length: 64 }).notNull().unique(),
  type: mysqlEnum("type", ["percent", "fixed"]).notNull().default("percent"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  usageLimit: int("usage_limit"),
  usageCount: int("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contactMessages = mysqlTable("contact_messages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 191 }).notNull(),
  subject: varchar("subject", { length: 191 }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  source: varchar("source", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
