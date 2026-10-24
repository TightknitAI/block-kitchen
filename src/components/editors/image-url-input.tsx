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
 * {@link ImageUploadConfig}, it also offers an upload button and a drop zone,
 * and writes the uploaded file's URL into the field.
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
      {input}
      <UploadDropZone upload={upload} inputId={id} onUploaded={onChange} />
    </div>
  );
}

/**
 * Dashed drop zone with an upload button, plus the upload's progress and error.
 * @param props - drop zone props
 * @param props.upload - the host's upload config
 * @param props.inputId - id of the URL input this fills, to derive the file input's id
 * @param props.onUploaded - called with the uploaded file's URL
 * @returns the rendered drop zone
 */
function UploadDropZone({
  upload,
  inputId,
  onUploaded
}: {
  upload: ResolvedImageUpload;
  inputId: string;
  onUploaded: (url: string) => void;
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

  return (
    <>
      <section
        aria-label="Upload an image"
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground transition-colors',
          dragging && 'border-primary bg-primary/5 text-primary'
        )}
      >
        <Upload className={cn('h-3.5 w-3.5 shrink-0', uploading && 'animate-pulse')} aria-hidden="true" />
        <span className="flex-1" aria-live="polite">
          {uploading ? 'Uploading…' : dragging ? 'Drop to upload' : 'Or drop an image here'}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload image
        </Button>
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
      </section>
      {error ? (
        <p role="alert" className="text-[11px] leading-snug text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
