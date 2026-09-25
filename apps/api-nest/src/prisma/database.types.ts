import type { Prisma } from '../generated/prisma/client.js';

/** Either the root client or an interactive transaction; repositories accept both. */
export type Db = Prisma.TransactionClient;
