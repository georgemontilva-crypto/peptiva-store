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
    carrier: varchar("carrier", { length: 32 }),
    trackingNumber: varchar("tracking_number", { length: 64 }),
    trackingUrl: varchar("tracking_url", { length: 512 }),
    shippedAt: timestamp("shipped_at"),
    completedAt: timestamp("completed_at"),
    adminNote: text("admin_note"),
    affiliateId: int("affiliate_id"),
    cartToken: varchar("cart_token", { length: 64 }),
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
  description: varchar("description", { length: 191 }),
  startsAt: timestamp("starts_at"),
  minSubtotal: decimal("min_subtotal", { precision: 10, scale: 2 }),
  perCustomerLimit: int("per_customer_limit"),
  /** Si el cupón pertenece a un afiliado, las ventas con este código se le atribuyen. */
  affiliateId: int("affiliate_id"),
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

export const admins = mysqlTable("admins", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Configuración editable desde el admin (clave → valor JSON). */
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

/** Historial de estados de cada pedido (línea de tiempo del seguimiento). */
export const orderEvents = mysqlTable(
  "order_events",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", orderStatuses).notNull(),
    note: varchar("note", { length: 500 }),
    /** Visible para el cliente en la página de seguimiento. */
    public: boolean("public").notNull().default(true),
    createdBy: varchar("created_by", { length: 32 }).notNull().default("system"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const abandonedCarts = mysqlTable(
  "abandoned_carts",
  {
    id: int("id").autoincrement().primaryKey(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    email: varchar("email", { length: 191 }).notNull(),
    firstName: varchar("first_name", { length: 80 }),
    lines: json("lines").$type<{ productId: number; variantId: number | null; quantity: number }[]>().notNull(),
    couponCode: varchar("coupon_code", { length: 64 }),
    affiliateCode: varchar("affiliate_code", { length: 64 }),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
    status: mysqlEnum("status", ["open", "recovered", "unsubscribed"]).notNull().default("open"),
    emailsSent: int("emails_sent").notNull().default(0),
    lastEmailAt: timestamp("last_email_at"),
    recoveredOrderId: int("recovered_order_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("abandoned_status_idx").on(t.status), index("abandoned_email_idx").on(t.email)],
);

export const affiliates = mysqlTable(
  "affiliates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 191 }).notNull().unique(),
    /** Código del enlace: ?ref=CODE */
    code: varchar("code", { length: 40 }).notNull().unique(),
    status: mysqlEnum("status", ["pending", "active", "rejected", "suspended"]).notNull().default("pending"),
    /** Porcentaje propio; si es null usa el general de Settings. */
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
    channel: varchar("channel", { length: 300 }),
    audience: varchar("audience", { length: 120 }),
    applicationNote: text("application_note"),
    payoutMethod: varchar("payout_method", { length: 40 }),
    payoutDetails: varchar("payout_details", { length: 300 }),
    adminNote: text("admin_note"),
    passwordHash: varchar("password_hash", { length: 255 }),
    lastLoginAt: timestamp("last_login_at"),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("affiliates_status_idx").on(t.status)],
);

/** Tokens de un solo uso para crear o recuperar la contraseña del afiliado (se guarda el hash). */
export const affiliateTokens = mysqlTable("affiliate_tokens", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const affiliateVisits = mysqlTable(
  "affiliate_visits",
  {
    id: int("id").autoincrement().primaryKey(),
    affiliateId: int("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
    landingPath: varchar("landing_path", { length: 255 }),
    referrer: varchar("referrer", { length: 255 }),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("visits_affiliate_idx").on(t.affiliateId, t.createdAt)],
);

export const payouts = mysqlTable("payouts", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: varchar("method", { length: 40 }),
  reference: varchar("reference", { length: 191 }),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commissions = mysqlTable(
  "commissions",
  {
    id: int("id").autoincrement().primaryKey(),
    affiliateId: int("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
    orderId: int("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
    /** Base: total de productos después de descuentos, sin envío. */
    base: decimal("base", { precision: 10, scale: 2 }).notNull(),
    rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["pending", "approved", "paid", "rejected"]).notNull().default("pending"),
    source: mysqlEnum("source", ["link", "coupon"]).notNull().default("link"),
    payoutId: int("payout_id"),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("commissions_affiliate_idx").on(t.affiliateId, t.status)],
);
