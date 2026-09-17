import { router } from "../trpc";
import { catalogRouter } from "./catalog";

export const appRouter = router({ catalog: catalogRouter });
export type AppRouter = typeof appRouter;
