import { useState } from 'react';
import type { ImageBlock, PublicImageBlock, SlackFileImageBlock } from 'slack-web-api-client';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import { useImageUpload } from '../../state/image-upload-context';
import { EditorField } from './field';
import { UploadDropZone } from './image-url-input';
import type { BlockEditorProps } from './types';

type ImageSourceKind = 'upload' | 'url' | 'slack_file';

/**
 * Editor form for image blocks. Slack backs an image block with either a
 * public `image_url` or a `slack_file` reference, and the "Image source"
 * radio switches between the two — so a block loaded with a `slack_file`
 * (which the builder can't upload or preview) can be converted to a plain
 * URL image, and back. When the host configured image uploads, an "Upload
 * image" source leads the radio and is selected first: it uploads a file
 * from the user's device and writes its URL to `image_url`. Alt text and
 * title apply to every source.
 * @param props - editor props
 * @param props.block - the image block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered image editor form
 */
export function ImageEditor({ block, onChange }: BlockEditorProps<ImageBlock>) {
  const upload = useImageUpload();
  // Upload and Public URL both back the block with `image_url`, so which of
  // the two shows is the editor's own choice rather than the block's.
  const [urlSource, setUrlSource] = useState<'upload' | 'url'>(upload ? 'upload' : 'url');
  const isSlackFile = 'slack_file' in block;
  const source: ImageSourceKind = isSlackFile ? 'slack_file' : upload ? urlSource : 'url';
  const titleText = block.title?.text ?? '';

  const setSource = (next: ImageSourceKind) => {
    if (next === source) {
      return;
    }
    if (next !== 'slack_file') {
      setUrlSource(next);
    }
    // Slack rejects a block carrying both keys, so the switch swaps one
    // backing field for the other. The default is spread first so a
    // malformed block that already carries both keys keeps its value.
    if (next !== 'slack_file' && isSlackFile) {
      const { slack_file: _omit, ...rest } = block as SlackFileImageBlock;
      onChange({ image_url: '', ...rest });
    } else if (next === 'slack_file') {
      const { image_url: _omit, ...rest } = block as PublicImageBlock;
      onChange({ slack_file: { id: '' }, ...rest });
    }
  };

  const sourceOptions: (readonly [ImageSourceKind, string])[] = [
    ...(upload ? [['upload', 'Upload image'] as const] : []),
    ['url', 'Public URL'],
    ['slack_file', 'Slack file']
  ];

  return (
    <div className="flex flex-col gap-3">
      <EditorField
        label="Image source"
        help={
          upload
            ? 'Where the image comes from: a file from your device, a public URL, or a file already uploaded to your Slack workspace.'
            : 'Where the image comes from: a public URL, or a file already uploaded to your Slack workspace.'
        }
      >
        <RadioGroup
          value={source}
          onValueChange={(v) => setSource(v as ImageSourceKind)}
          className="flex flex-row flex-wrap gap-3"
        >
          {sourceOptions.map(([value, label]) => (
            <div key={value} className="flex items-center gap-1.5">
              <RadioGroupItem value={value} id={`img-source-${value}`} />
              <Label htmlFor={`img-source-${value}`} className="text-xs">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>

      {'slack_file' in block ? (
        <SlackFileFields block={block} onChange={onChange} />
      ) : source === 'upload' && upload ? (
        <UploadDropZone
          upload={upload}
          inputId="img-upload"
          variant="panel"
          onUploaded={(url) => onChange({ ...block, image_url: url })}
        />
      ) : (
        <EditorField label="Image URL" help="A publicly accessible image URL (PNG, JPG, GIF)." htmlFor="img-url">
          <Input
            id="img-url"
            type="url"
            value={block.image_url ?? ''}
            placeholder="e.g. https://example.com/cover.png"
            onChange={(e) => onChange({ ...block, image_url: e.target.value })}
          />
        </EditorField>
      )}

      <EditorField
        label="Alt text"
        help="Describes the image for screen readers and when the image fails to load."
        htmlFor="img-alt"
      >
        <Input
          id="img-alt"
          value={block.alt_text ?? ''}
          placeholder="e.g. Quarterly roadmap cover"
          onChange={(e) => onChange({ ...block, alt_text: e.target.value })}
        />
      </EditorField>
      <EditorField label="Title (optional)" help="Shown as a caption above the image." htmlFor="img-title">
        <Input
          id="img-title"
          value={titleText}
          placeholder="e.g. Q2 Roadmap"
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...block,
              title: v ? { type: 'plain_text', text: v, emoji: true } : undefined
            });
          }}
        />
      </EditorField>
    </div>
  );
}

/**
 * Sub-form for the `slack_file` backing: the file's ID or its Slack URL.
 * Slack accepts exactly one of the two, so editing one field rewrites the
 * reference and clears the other. The builder can't upload files or
 * render workspace files in the preview, so a note says as much.
 * @param props - field props
 * @param props.block - the slack_file-backed image block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered slack-file fields
 */
function SlackFileFields({
  block,
  onChange
}: {
  block: SlackFileImageBlock;
  onChange: (next: SlackFileImageBlock) => void;
}) {
  const fileId = 'id' in block.slack_file ? block.slack_file.id : '';
  const fileUrl = 'url' in block.slack_file ? block.slack_file.url : '';

  return (
    <>
      <p className="text-[11px] leading-snug text-muted-foreground">
        References a file already uploaded to your Slack workspace. The preview can't render workspace files — switch
        the source to Public URL to see the image here.
      </p>
      <EditorField
        label="File ID"
        help="The Slack file's ID. Slack accepts an ID or a URL, not both, so filling this clears File URL."
        htmlFor="img-file-id"
      >
        <Input
          id="img-file-id"
          value={fileId}
          placeholder="e.g. F0123456789"
          onChange={(e) => onChange({ ...block, slack_file: { id: e.target.value } })}
        />
      </EditorField>
      <EditorField
        label="File URL"
        help="The file's Slack-hosted URL. Filling this clears File ID."
        htmlFor="img-file-url"
      >
        <Input
          id="img-file-url"
          type="url"
          value={fileUrl}
          placeholder="e.g. https://files.slack.com/files-pri/T0123-F0123/image.png"
          onChange={(e) => onChange({ ...block, slack_file: { url: e.target.value } })}
        />
      </EditorField>
    </>
  );
}
