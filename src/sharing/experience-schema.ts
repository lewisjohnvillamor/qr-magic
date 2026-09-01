import { z } from 'zod';
import { MAX_URL_LENGTH } from '../qr/normalize-url';
import { SCULPTURE_IDS, DEFAULT_SCULPTURE } from '../voxel/types';
import { THEME_IDS, DEFAULT_THEME } from '../themes/themes';

export const EXPERIENCE_SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Expected a hex colour');

/**
 * The shape of a shared experience.
 *
 * Only public presentation data lives here. Unknown fields are stripped rather
 * than rejected so that links written by a newer build still open, and every
 * optional field has a safe default.
 */
export const experiencePayloadSchema = z.object({
  v: z.number().int().min(1).max(EXPERIENCE_SCHEMA_VERSION),
  url: z.string().min(1).max(MAX_URL_LENGTH),
  sculpture: z.enum(SCULPTURE_IDS).catch(DEFAULT_SCULPTURE),
  theme: z.enum(THEME_IDS).catch(DEFAULT_THEME),
  foreground: hexColor.optional(),
  background: hexColor.optional(),
});

export type ExperiencePayload = z.infer<typeof experiencePayloadSchema>;
