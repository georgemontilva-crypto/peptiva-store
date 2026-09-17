import { router } from "../trpc";
import { catalogRouter } from "./catalog";
import { contentRouter } from "./content";
import { shopRouter } from "./shop";

export const appRouter = router({ catalog: catalogRouter, shop: shopRouter, content: contentRouter });
export type AppRouter = typeof appRouter;
