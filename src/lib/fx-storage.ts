// This file was written by GPT 5.5, under human supervision.

import {
  FX_MANIFEST_KEY,
  type FxManifest,
  type FxRateSnapshot,
  parseFxManifest,
  parseFxRateSnapshot,
  toRateSnapshotKey,
} from "./fx";

const JSON_HTTP_METADATA = {
  contentType: "application/json; charset=utf-8",
} as const;

export async function readFxManifest(
  bucket: R2Bucket,
): Promise<FxManifest | undefined> {
  const object = await bucket.get(FX_MANIFEST_KEY);
  if (!object) {
    return undefined;
  }

  return parseFxManifest(await object.json<unknown>());
}

export async function readFxRateSnapshot(
  bucket: R2Bucket,
  key: string,
): Promise<FxRateSnapshot | undefined> {
  const object = await bucket.get(key);
  if (!object) {
    return undefined;
  }

  return parseFxRateSnapshot(await object.json<unknown>());
}

export async function writeFxRateSnapshot(
  bucket: R2Bucket,
  snapshot: FxRateSnapshot,
): Promise<void> {
  await bucket.put(
    toRateSnapshotKey(snapshot.from, snapshot.to),
    JSON.stringify(snapshot),
    {
      httpMetadata: JSON_HTTP_METADATA,
    },
  );
}

export async function writeFxManifest(
  bucket: R2Bucket,
  manifest: FxManifest,
): Promise<void> {
  await bucket.put(FX_MANIFEST_KEY, JSON.stringify(manifest), {
    httpMetadata: JSON_HTTP_METADATA,
  });
}

export async function writeFxSnapshotsAndManifest(
  bucket: R2Bucket,
  snapshots: readonly FxRateSnapshot[],
  manifest: FxManifest,
): Promise<void> {
  await Promise.all(
    snapshots.map((snapshot) => writeFxRateSnapshot(bucket, snapshot)),
  );
  await writeFxManifest(bucket, manifest);
}
