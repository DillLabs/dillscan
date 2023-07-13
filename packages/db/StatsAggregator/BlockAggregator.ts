import { Prisma } from "@prisma/client";

import type { BlobscanPrismaClient } from "../prisma";
import {
  buildRawWhereClause,
  buildWhereClause,
  getDefaultDatePeriod,
} from "../utils/dates";
import type { DatePeriod } from "../utils/dates";

export class BlockAggregator {
  #prisma: BlobscanPrismaClient;

  constructor(prisma: BlobscanPrismaClient) {
    this.#prisma = prisma;
  }

  async backfillBlockDailyAggregates(datePeriod: DatePeriod) {
    // TODO: implement some sort of bulk processing mechanism.

    // Delete all the rows if current date is set as target date
    if (!datePeriod) {
      await this.#prisma.$executeRawUnsafe(`TRUNCATE TABLE "BlockDailyStats"`);
    } else {
      await this.#prisma.blockDailyStats.deleteMany({
        where: buildWhereClause("day", datePeriod),
      });
    }

    const dailyBlockStats = await this.getDailyBlockAggregates(datePeriod);

    return this.#prisma.blockDailyStats.createMany({
      data: dailyBlockStats,
    });
  }

  getDailyBlockAggregates(
    datePeriod: DatePeriod = getDefaultDatePeriod()
  ): Prisma.PrismaPromise<Prisma.BlockDailyStatsCreateManyInput[]> {
    const dateField = Prisma.sql`timestamp`;
    const whereClause = buildRawWhereClause(dateField, datePeriod);

    return this.#prisma.$queryRaw<Prisma.BlockDailyStatsCreateManyInput[]>`
      SELECT COUNT(id)::Int as "totalBlocks", DATE_TRUNC('day', ${dateField}) as "day"
      FROM "Block"
      ${whereClause}
      GROUP BY "day"
    `;
  }

  executeOverallBlockStatsQuery() {
    return this.#prisma.$executeRaw`
    INSERT INTO "BlockOverallStats" as stats (
      id,
      "totalBlocks",
      "updatedAt"
    )
    SELECT
      1 as id,
      COUNT("id")::INT as "totalBlocks",
      NOW() as "updatedAt"
    FROM "Block"
    ON CONFLICT (id) DO UPDATE SET
      "totalBlocks" = EXCLUDED."totalBlocks",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
  }

  upsertOverallBlockStats(newBlocks: number) {
    return this.#prisma.$executeRaw`
      INSERT INTO "BlockOverallStats" as stats (
        id,
        "totalBlocks",
        "updatedAt"
      )
      VALUES (
        1,
        ${newBlocks},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        "totalBlocks" = stats."totalBlocks" + EXCLUDED."totalBlocks",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE stats.id = 1
    `;
  }
}
