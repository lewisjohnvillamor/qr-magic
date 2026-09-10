import { z } from 'zod';
import { MAX_PAYLOAD_LENGTH, PAYLOAD_KINDS, DEFAULT_PAYLOAD_KIND } from '../qr/payloads';
import { SHAPE_IDS, DEFAULT_MODULE_SHAPE, DEFAULT_CORNER_SHAPE } from '../qr/shapes';
import { SCULPTURE_IDS, DEFAULT_SCULPTURE } from '../voxel/types';
import { THEME_IDS, DEFAULT_THEME } from '../themes/themes';

export const EXPERIENCE_SCHEMA_VERSION = 2;

/** Longest a single shared draft field may be. */
const MAX_FIELD_LENGTH = 600;

/**
 * The shape of a shared experience.
 *
 * Only public presentation data lives here. Unknown fields are stripped rather
 * than rejected, so links written by a newer build still open — and so do the
 * older ones that carried a pair of brand colours, from back when a theme took
 * them. Anything the current build no longer recognises falls back to a default
 * rather than failing the parse, which is also how a version-1 link — no kind,
 * no shapes, just a URL — opens correctly today.
 *
 * `url` keeps its name for exactly that reason: in a version-1 link it is the
 * destination, and in a version-2 one it is the encoded value, which for the
 * `url` kind is the same string.
 */
export const experiencePayloadSchema = z.object({
  v: z.number().int().min(1).max(EXPERIENCE_SCHEMA_VERSION),
  url: z.string().min(1).max(MAX_PAYLOAD_LENGTH),
  kind: z.enum(PAYLOAD_KINDS).catch(DEFAULT_PAYLOAD_KIND),
  /**
   * The draft fields, so the author's own link reopens editable.
   *
   * Also the recipient's safety check: when these are present the value is
   * re-encoded from them on the way in rather than trusted, so a hand-edited
   * payload cannot smuggle a string this app would never have produced.
   */
  f: z.record(z.string(), z.string().max(MAX_FIELD_LENGTH)).optional().catch(undefined),
  sculpture: z.enum(SCULPTURE_IDS).catch(DEFAULT_SCULPTURE),
  theme: z.enum(THEME_IDS).catch(DEFAULT_THEME),
  module: z.enum(SHAPE_IDS).catch(DEFAULT_MODULE_SHAPE),
  corner: z.enum(SHAPE_IDS).catch(DEFAULT_CORNER_SHAPE),
});

export type ExperiencePayload = z.infer<typeof experiencePayloadSchema>;
