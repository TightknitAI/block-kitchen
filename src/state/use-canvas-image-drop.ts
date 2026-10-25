import { type DragEvent, useRef, useState } from 'react';
import type { SupportedBlock } from '../types';
import {
  formatList,
  isAcceptedImage,
  isFileDrag,
  type ResolvedImageUpload,
  uploadErrorMessage
} from './image-upload-context';

/** Slack's cap on an image block's `alt_text`. */
const ALT_TEXT_MAX_LENGTH = 2000;

/** Handlers to spread on the drop target. */
export interface CanvasImageDropHandlers {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

/** What the canvas shows while files are dragged over it and uploaded. */
export interface CanvasImageDrop {
  /** Spread on the drop target; undefined when drops are off. */
  handlers: CanvasImageDropHandlers | undefined;
  /** Whether files are being dragged over the target. */
  dragging: boolean;
  /** How many dropped images are still uploading. */
  pending: number;
  /** Why the last drop added fewer blocks than files, until dismissed. */
  error: string | null;
  dismissError: () => void;
}

/**
 * The alt text an uploaded image starts with: its file name, minus the
 * extension. Slack requires alt text, and the name is the best guess at
 * what the image shows until the user writes their own.
 * @param file - the uploaded file
 * @returns the starting alt text
 */
export function altTextFromFileName(file: File): string {
  const name = file.name.replace(/\.[^.]+$/, '').trim();
  return (name || 'Image').slice(0, ALT_TEXT_MAX_LENGTH);
}

/**
 * Turns image files dropped on the canvas into image blocks: each file is
 * uploaded through the host and, once it has a URL, appended as an image
 * block, in the order the files were dropped.
 * @param options - drop options
 * @param options.upload - the host's upload config, or null when uploads are off
 * @param options.enabled - whether image blocks may be added at all
 * @param options.onAddBlock - appends a block to the draft
 * @returns the drop handlers and status
 */
export function useCanvasImageDrop({
  upload,
  enabled,
  onAddBlock
}: {
  upload: ResolvedImageUpload | null;
  enabled: boolean;
  onAddBlock: ((block: SupportedBlock) => void) | undefined;
}): CanvasImageDrop {
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onAddBlockRef = useRef(onAddBlock);
  onAddBlockRef.current = onAddBlock;

  const addFiles = async (activeUpload: ResolvedImageUpload, files: File[]) => {
    const images = files.filter((file) => isAcceptedImage(file, activeUpload.accept));
    const skipped = files.length - images.length;
    setError(
      skipped > 0
        ? `${skipped === 1 ? '1 file was' : `${skipped} files were`} skipped. Only ${formatList(activeUpload.accept)} images can be added.`
        : null
    );
    if (images.length === 0) {
      return;
    }
    setPending((count) => count + images.length);
    const results = await Promise.allSettled(images.map((file) => activeUpload.uploadImage(file)));
    setPending((count) => count - images.length);
    const failures: string[] = [];
    results.forEach((result, idx) => {
      const file = images[idx];
      if (result.status === 'fulfilled') {
        onAddBlockRef.current?.({ type: 'image', image_url: result.value.url, alt_text: altTextFromFileName(file) });
      } else {
        failures.push(`Couldn't upload "${file.name}": ${uploadErrorMessage(result.reason)}`);
      }
    });
    if (failures.length > 0) {
      setError(failures.join(' '));
    }
  };

  // Events from the open block editor reach here too, since React bubbles
  // through its portal; only drags over the canvas itself count.
  const isOwnEvent = (e: DragEvent<HTMLElement>) =>
    isFileDrag(e.dataTransfer) && e.currentTarget.contains(e.target as Node);

  const handlers: CanvasImageDropHandlers | undefined =
    upload && enabled && onAddBlock
      ? {
          onDragOver: (e) => {
            if (!isOwnEvent(e)) {
              return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragging(true);
          },
          onDragLeave: (e) => {
            const next = e.relatedTarget as Node | null;
            if (!next || !e.currentTarget.contains(next)) {
              setDragging(false);
            }
          },
          onDrop: (e) => {
            if (!isOwnEvent(e)) {
              return;
            }
            e.preventDefault();
            setDragging(false);
            void addFiles(upload, Array.from(e.dataTransfer.files));
          }
        }
      : undefined;

  return { handlers, dragging, pending, error, dismissError: () => setError(null) };
}
