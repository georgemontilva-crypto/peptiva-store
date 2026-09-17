import { router } from "../trpc";
import { catalogRouter } from "./catalog";
import { contentRouter } from "./content";
import { shopRouter } from "./shop";
import { adminRouter } from "./admin";
import { affiliatePortalRouter } from "./affiliatePortal";

export const appRouter = router({ catalog: catalogRouter, shop: shopRouter, content: contentRouter, admin: adminRouter, affiliate: affiliatePortalRouter });
export type AppRouter = typeof appRouter;
