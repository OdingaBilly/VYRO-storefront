import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetProductParams,
  GetProductResponse,
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
} from "@workspace/api-zod";
import {
  getPublishedProduct,
  listCategories,
  listProducts,
} from "../lib/catalogue";

const router: IRouter = Router();

router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  const categories = await listCategories();
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/products", async (req: Request, res: Response): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const result = await listProducts(query.data);
  res.json(ListProductsResponse.parse(result));
});

router.get(
  "/products/:slug",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const product = await getPublishedProduct(params.data.slug);
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.json(GetProductResponse.parse(product));
  },
);

export default router;
