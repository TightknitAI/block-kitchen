import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ImageUploadConfig } from '../types';

/** The formats Slack renders in an image block. */
export const DEFAULT_IMAGE_UPLOAD_ACCEPT: readonly string[] = ['image/png', 'image/jpeg', 'image/gif'];

/** The host's upload config, with `accept` resolved to its default. */
export interface ResolvedImageUpload {
  uploadImage: ImageUploadConfig['uploadImage'];
  accept: readonly string[];
}

const ImageUploadContext = createContext<ResolvedImageUpload | null>(null);

/**
 * Provides the host's {@link ImageUploadConfig} to the builder tree, so image
 * URL fields and the canvas can reach the upload without prop-drilling through
 * `Surface → block-row → block-editor → *-editor`.
 *
 * @param props.imageUpload - the host's upload config, or undefined to disable uploads
 * @param props.children - the subtree that can read the context
 */
export function ImageUploadProvider({
  imageUpload,
  children
}: {
  imageUpload?: ImageUploadConfig;
  children: ReactNode;
}) {
  const uploadImage = imageUpload?.uploadImage;
  const accept = imageUpload?.accept;
  const value = useMemo<ResolvedImageUpload | null>(
    () => (uploadImage ? { uploadImage, accept: accept ?? DEFAULT_IMAGE_UPLOAD_ACCEPT } : null),
    [uploadImage, accept]
  );
  return <ImageUploadContext.Provider value={value}>{children}</ImageUploadContext.Provider>;
}

/**
 * Reads the upload config. Returns null outside an {@link ImageUploadProvider}
 * or when the host passed none, so it is always safe to call.
 */
export function useImageUpload(): ResolvedImageUpload | null {
  return useContext(ImageUploadContext);
}

/**
 * Whether a file is one of the accepted image types.
 * @param file - the picked or dropped file
 * @param accept - accepted MIME types
 * @returns true when the file's type is accepted
 */
export function isAcceptedImage(file: File, accept: readonly string[]): boolean {
  return accept.includes(file.type);
}

/**
 * The message to show for a failed upload: the host's own when it gave one.
 * @param error - what the upload rejected with
 * @returns user-facing copy
 */
export function uploadErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Upload failed. Try again.';
}

/**
 * Whether a drag carries files from the OS, as opposed to a palette or
 * reorder drag, which dnd-kit drives with pointer events rather than HTML5
 * drag-and-drop.
 * @param dataTransfer - the drag event's data transfer
 * @returns true when the drag carries files
 */
export function isFileDrag(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'));
}

/**
 * Names the accepted formats for copy, e.g. `PNG, JPEG or GIF`.
 * @param accept - accepted MIME types
 * @returns the formats as a readable list
 */
export function formatList(accept: readonly string[]): string {
  const names = accept.map((type) => type.replace(/^image\//, '').toUpperCase());
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : (names[0] ?? '');
}
