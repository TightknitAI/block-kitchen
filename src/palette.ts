/**
 * Palette subpath: `@tightknitai/block-kitchen/palette`.
 *
 * Re-exports the default palette and its building blocks for consumers
 * who want to compose a custom palette without importing the full
 * builder component tree.
 */

export type { PaletteSection, PaletteVariant } from './lib/default-blocks';
export {
  buildVariantById,
  defaultPalette,
  extraAlertVariant,
  legacyInputVariants
} from './lib/default-blocks';
export type { PaletteMode, SupportedBlock, SupportedBlockType } from './types';
