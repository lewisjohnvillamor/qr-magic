import { z } from 'zod';
import { MAX_URL_LENGTH } from '../qr/normalize-url';
import { SCULPTURE_IDS, DEFAULT_SCULPTURE } from '../voxel/types';
import { THEME_IDS, DEFAULT_THEME } from '../themes/themes';

export const EXPERIENCE_SCHEMA_VERSION = 1;

/**
 * The shape of a shared experience.
 *
 * Only public presentation data lives here. Unknown fields are stripped rather
 * than rejected, so links written by a newer build still open — and so do the
 * older ones that carried a pair of brand colours, from back when a theme took
 * them. A theme that no longer exists falls back to the default rather than
 * failing the parse.
 */
export const experiencePayloadSchema = z.object({
  v: z.number().int().min(1).max(EXPERIENCE_SCHEMA_VERSION),
  url: z.string().min(1).max(MAX_URL_LENGTH),
  sculpture: z.enum(SCULPTURE_IDS).catch(DEFAULT_SCULPTURE),
  theme: z.enum(THEME_IDS).catch(DEFAULT_THEME),
});

export type ExperiencePayload = z.infer<typeof experiencePayloadSchema>;
