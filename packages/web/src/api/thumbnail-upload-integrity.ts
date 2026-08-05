export async function uploadAllOrCleanup(
  uploads: readonly Promise<string>[],
  cleanup: (keys: readonly string[]) => Promise<void>,
): Promise<string[]> {
  const results = await Promise.allSettled(uploads);
  const uploadedKeys = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (!failed) return uploadedKeys;

  await cleanup(uploadedKeys);
  throw failed.reason;
}
