import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateProductBody,
  CreateProductResponse,
  GetAdminSummaryResponse,
  ListAdminProductsQueryParams,
  ListAdminProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin";
import {
  CatalogueValidationError,
  createProduct,
  getAdminSummary,
  isUniqueConflict,
  listAdminProducts,
  updateProduct,
} from "../lib/catalogue";

const router: IRouter = Router();

function writeFailure(
  error: unknown,
  req: Request,
  res: Response,
  conflictMessage: string,
): void {
  if (error instanceof CatalogueValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (isUniqueConflict(error)) {
    res.status(409).json({ error: conflictMessage });
    return;
  }

  req.log.error({ err: error }, "Catalogue write failed.");
  res.status(500).json({ error: "Could not save this catalogue change." });
}

router.get(
  "/admin/summary",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    res.json(GetAdminSummaryResponse.parse(await getAdminSummary()));
  },
);

router.get(
  "/admin/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const query = ListAdminProductsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }

    const products = await listAdminProducts(query.data);
    res.json(ListAdminProductsResponse.parse(products));
  },
);

router.post(
  "/admin/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const body = CreateProductBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    if (!req.adminActorId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    try {
      const product = await createProduct(body.data, req.adminActorId);
      res.status(201).json(CreateProductResponse.parse(product));
    } catch (error) {
      writeFailure(
        error,
        req,
        res,
        "That product slug or SKU is already in use.",
      );
    }
  },
);

router.patch(
  "/admin/products/:productId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const params = UpdateProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = UpdateProductBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    if (!req.adminActorId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    try {
      const product = await updateProduct(
        params.data.productId,
        body.data,
        req.adminActorId,
      );
      if (!product) {
        res.status(404).json({ error: "Product not found." });
        return;
      }
      res.json(UpdateProductResponse.parse(product));
    } catch (error) {
      writeFailure(
        error,
        req,
        res,
        "That product slug or SKU is already in use.",
      );
    }
  },
);

export default router;
