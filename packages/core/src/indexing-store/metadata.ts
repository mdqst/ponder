import type { HeadlessKysely } from "@/database/kysely.js";
import type { Status } from "@/sync/index.js";

export type MetadataStore = {
  setStatus: (status: Status) => Promise<void>;
  getStatus: () => Promise<Status | null>;
};

export const getMetadataStore = ({
  db,
  instanceId,
}: {
  db: HeadlessKysely<any>;
  instanceId: string;
}): MetadataStore => ({
  getStatus: async () => {
    return db.wrap({ method: "_ponder_meta.getStatus()" }, async () => {
      const metadata = await db
        .selectFrom("_ponder_meta")
        .select("value")
        .where("key", "=", `status_${instanceId}`)
        .executeTakeFirst();

      if (metadata!.value === null) return null;

      return metadata!.value as Status;
    });
  },
  setStatus: (status: Status) => {
    return db.wrap({ method: "_ponder_meta.setStatus()" }, async () => {
      await db
        .insertInto("_ponder_meta")
        .values({
          key: `status_${instanceId}`,
          value: status,
        })
        .onConflict((oc) =>
          oc.column("key").doUpdateSet({
            value: status,
          }),
        )
        .execute();
    });
  },
});
