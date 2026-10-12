import { Readable } from "node:stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawPath = req.params.filePath;
      const filePath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
      const file = await storage.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found." });
        return;
      }

      const response = await storage.downloadObject(file);
      res.status(response.status);
      response.headers.forEach((value, name) => res.setHeader(name, value));

      if (response.body) {
        Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        ).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, "Failed to serve a public storage object.");
      res.status(500).json({ error: "Could not load this media file." });
    }
  },
);

export default router;
