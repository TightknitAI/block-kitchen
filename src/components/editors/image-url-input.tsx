import { Upload } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import {
  formatList,
  isAcceptedImage,
  isFileDrag,
  type ResolvedImageUpload,
  uploadErrorMessage,
  useImageUpload
} from '../../state/image-upload-context';

/**
 * The URL input for an image field. When the host configured
 * {@link ImageUploadConfig}, an upload button and drop zone come first, with
 * the URL input beneath, and an upload writes the file's URL into the field.
 * @param props - input props
 * @param props.id - id of the URL input, for its label
 * @param props.value - the current image URL
 * @param props.placeholder - greyed-out example URL
 * @param props.onChange - called with the typed or uploaded URL
 * @returns the rendered URL input, with upload controls when enabled
 */
export function ImageUrlInput({
  id,
  value,
  placeholder,
  onChange
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (url: string) => void;
}) {
  const upload = useImageUpload();
  const input = (
    <Input id={id} type="url" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );
  if (!upload) {
    return input;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <UploadDropZone upload={upload} inputId={id} onUploaded={onChange} variant="inline" />
      {input}
    </div>
  );
}

/**
 * Dashed drop zone with a file picker button, plus the upload's progress and
 * error. `inline` is a one-line strip under a URL input; `panel` is a taller
 * zone that stands in for the URL input altogether.
 * @param props - drop zone props
 * @param props.upload - the host's upload config
 * @param props.inputId - base id for the zone's file input
 * @param props.onUploaded - called with the uploaded file's URL
 * @param props.variant - `inline` strip or standalone `panel`
 * @returns the rendered drop zone
 */
export function UploadDropZone({
  upload,
  inputId,
  onUploaded,
  variant
}: {
  upload: ResolvedImageUpload;
  inputId: string;
  onUploaded: (url: string) => void;
  variant: 'inline' | 'panel';
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // An upload outlives the render that started it, so it reports through the
  // latest callback, which closes over the block as it is now.
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const uploadFile = async (file: File) => {
    if (!isAcceptedImage(file, upload.accept)) {
      setError(`"${file.name}" isn't a supported image. Use ${formatList(upload.accept)}.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { url } = await upload.uploadImage(file);
      onUploadedRef.current(url);
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  // Stops at the zone: the editor popover is a React child of the canvas, which
  // would otherwise also take the drop and add a second image block.
  const onDragOver = (e: DragEvent) => {
    if (!isFileDrag(e.dataTransfer)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    if (!isFileDrag(e.dataTransfer)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const [file] = Array.from(e.dataTransfer.files);
    if (file && !uploading) {
      void uploadFile(file);
    }
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      id={`${inputId}-file`}
      type="file"
      accept={upload.accept.join(',')}
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Cleared so picking the same file again after an error retries it.
        e.target.value = '';
        if (file) {
          void uploadFile(file);
        }
      }}
    />
  );
  const pickButton = (label: string) => (
    <Button type="button" size="sm" className="h-7" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
      {label}
    </Button>
  );
  const dropHandlers = { onDragOver, onDragLeave: () => setDragging(false), onDrop };

  return (
    <>
      {variant === 'panel' ? (
        <section
          aria-label="Upload an image"
          {...dropHandlers}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center text-xs text-muted-foreground transition-colors',
            dragging && 'border-primary bg-primary/5 text-primary'
          )}
        >
          <Upload className={cn('h-5 w-5', uploading && 'animate-pulse')} aria-hidden="true" />
          <span aria-live="polite">
            {uploading ? 'Uploading…' : dragging ? 'Drop to upload' : 'Drag an image here, or'}
          </span>
          {pickButton('Choose file')}
          <span className="text-[11px]">{formatList(upload.accept)}</span>
          {fileInput}
        </section>
      ) : (
        <section
          aria-label="Upload an image"
          {...dropHandlers}
          className={cn(
            'flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground transition-colors',
            dragging && 'border-primary bg-primary/5 text-primary'
          )}
        >
          <Upload className={cn('h-3.5 w-3.5 shrink-0', uploading && 'animate-pulse')} aria-hidden="true" />
          <span className="flex-1" aria-live="polite">
            {uploading ? 'Uploading…' : dragging ? 'Drop to upload' : 'Drop an image here, or paste a URL below'}
          </span>
          {pickButton('Upload image')}
          {fileInput}
        </section>
      )}
      {error ? (
        <p role="alert" className="text-[11px] leading-snug text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
