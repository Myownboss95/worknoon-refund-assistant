import { z } from 'zod';

/** Path ids are UUIDs; anything else cannot exist and the validation pipe turns it into a 404. */
export const IdParamSchema = z.uuid();
