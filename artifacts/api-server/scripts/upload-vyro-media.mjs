import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { objectStorageClient } from "../dist/lib/objectStorage.mjs";
import { setObjectAclPolicy } from "../dist/lib/objectAcl.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(
  scriptDir,
  "../../.local/conversation-workspace/files/attached_assets",
);

const media = [
  ["icon-0.2_1791828673226.png", "vyro-logo.png", "image/png"],
  ["moodboard-02_1791828673226.png", "moodboard-reference.png", "image/png"],
  ["01_1791828673225.png", "field-01.png", "image/png"],
  ["02_1791828673225.jpg", "field-02.jpg", "image/jpeg"],
  ["03_1791828673224.jpg", "field-03.jpg", "image/jpeg"],
  ["04_1791828673224.jpg", "field-04.jpg", "image/jpeg"],
  ["05_1791828673223.jpg", "field-05.jpg", "image/jpeg"],
  ["06_1791828673223.jpg", "field-06.jpg", "image/jpeg"],
  ["07_1791828673223.jpg", "field-07.jpg", "image/jpeg"],
  [
    "pinsave-video_(1)_1791828629283.mp4",
    "ride-film-01.mp4",
    "video/mp4",
  ],
  ["pinsave-video_1791828629284.mp4", "ride-film-02.mp4", "video/mp4"],
];

const publicSearchPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS
  ?.split(",")
  .map((value) => value.trim())
  .find(Boolean);

if (!publicSearchPath) {
  throw new Error("VYRO media upload requires configured App Storage.");
}

const [bucketName, ...prefixParts] = publicSearchPath
  .replace(/^\/+/, "")
  .split("/");
if (!bucketName) {
  throw new Error("VYRO media upload could not resolve its public bucket.");
}

const publicPrefix = [...prefixParts, "vyro"].filter(Boolean).join("/");
const bucket = objectStorageClient.bucket(bucketName);

for (const [sourceName, destinationName, contentType] of media) {
  const sourcePath = path.join(sourceDir, sourceName);
  const file = bucket.file(`${publicPrefix}/${destinationName}`);
  const contents = await readFile(sourcePath);
  await file.save(contents, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  await setObjectAclPolicy(file, {
    owner: "vyro-public-brand-assets",
    visibility: "public",
  });
  console.info(`Uploaded ${destinationName}`);
}

console.info(`Uploaded ${media.length} VYRO brand media files to App Storage.`);
