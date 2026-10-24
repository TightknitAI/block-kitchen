import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImageBlock } from 'slack-web-api-client';
import { describe, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import { BlockEditor } from '../src/components/editors/block-editor';
import { ImageUploadProvider } from '../src/state/image-upload-context';
import type { ImageUploadConfig, SupportedBlock } from '../src/types';

const URL_BLOCK: ImageBlock = {
  type: 'image',
  image_url: 'https://example.com/cover.png',
  alt_text: 'Cover'
};

const UPLOADED_URL = 'https://files.example.com/t1/roadmap.png';

function png(name = 'roadmap.png'): File {
  return new File(['png-bytes'], name, { type: 'image/png' });
}

function fileDrag(files: File[]) {
  return { dataTransfer: { files, types: ['Files'], dropEffect: 'none' } };
}

function pickFile(container: HTMLElement, id: string, file: File) {
  const input = container.querySelector<HTMLInputElement>(`#${id}-file`);
  if (!input) {
    throw new Error(`no file input for #${id}`);
  }
  fireEvent.change(input, { target: { files: [file] } });
}

describe('image URL field uploads', () => {
  it('offers no upload without the host config', () => {
    render(<BlockEditor block={URL_BLOCK} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('writes the uploaded URL into the block, keeping its other fields', async () => {
    const uploadImage = vi.fn<ImageUploadConfig['uploadImage']>().mockResolvedValue({ url: UPLOADED_URL });
    const onChange = vi.fn();
    const { container } = render(
      <ImageUploadProvider imageUpload={{ uploadImage }}>
        <BlockEditor block={URL_BLOCK} onChange={onChange} />
      </ImageUploadProvider>
    );

    const file = png();
    pickFile(container, 'img-url', file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...URL_BLOCK, image_url: UPLOADED_URL }));
    expect(uploadImage).toHaveBeenCalledWith(file);
  });

  it('applies the upload to the block as it is when the upload finishes', async () => {
    let finish: (value: { url: string }) => void = () => {};
    const uploadImage = vi.fn<ImageUploadConfig['uploadImage']>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const onChange = vi.fn();
    const { container, rerender } = render(
      <ImageUploadProvider imageUpload={{ uploadImage }}>
        <BlockEditor block={URL_BLOCK} onChange={onChange} />
      </ImageUploadProvider>
    );

    pickFile(container, 'img-url', png());
    // Alt text edited while the upload is in flight.
    const edited: ImageBlock = { ...URL_BLOCK, alt_text: 'Q3 roadmap' };
    rerender(
      <ImageUploadProvider imageUpload={{ uploadImage }}>
        <BlockEditor block={edited} onChange={onChange} />
      </ImageUploadProvider>
    );
    await act(async () => finish({ url: UPLOADED_URL }));

    expect(onChange).toHaveBeenLastCalledWith({ ...edited, image_url: UPLOADED_URL });
  });

  it("shows the host's reason when the upload fails, and leaves the block alone", async () => {
    const uploadImage = vi
      .fn<ImageUploadConfig['uploadImage']>()
      .mockRejectedValue(new Error('File size exceeds 5 MB limit'));
    const onChange = vi.fn();
    const { container } = render(
      <ImageUploadProvider imageUpload={{ uploadImage }}>
        <BlockEditor block={URL_BLOCK} onChange={onChange} />
      </ImageUploadProvider>
    );

    pickFile(container, 'img-url', png());

    expect((await screen.findByRole('alert')).textContent).toBe('File size exceeds 5 MB limit');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a file outside the accepted types without uploading it', async () => {
    const uploadImage = vi.fn<ImageUploadConfig['uploadImage']>();
    const { container } = render(
      <ImageUploadProvider imageUpload={{ uploadImage }}>
        <BlockEditor block={URL_BLOCK} onChange={vi.fn()} />
      </ImageUploadProvider>
    );

    pickFile(container, 'img-url', new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Use PNG, JPEG or GIF');
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('uploads a file dropped on the field without passing the drop on to the canvas', async () => {
    const uploadImage = vi.fn<ImageUploadConfig['uploadImage']>().mockResolvedValue({ url: UPLOADED_URL });
    const onChange = vi.fn();
    const canvasDrop = vi.fn();
    render(
      <div onDrop={canvasDrop}>
        <ImageUploadProvider imageUpload={{ uploadImage }}>
          <BlockEditor block={URL_BLOCK} onChange={onChange} />
        </ImageUploadProvider>
      </div>
    );

    fireEvent.drop(screen.getByRole('region', { name: 'Upload an image' }), fileDrag([png()]));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...URL_BLOCK, image_url: UPLOADED_URL }));
    expect(canvasDrop).not.toHaveBeenCalled();
  });
});

describe('dropping images on the canvas', () => {
  it('appends an image block per uploaded file, alt text from its name', async () => {
    const uploadImage = vi
      .fn<ImageUploadConfig['uploadImage']>()
      .mockImplementation(async (file) => ({ url: `https://files.example.com/${file.name}` }));
    const onChange = vi.fn<(blocks: SupportedBlock[]) => void>();
    render(<BlockKitchen initialBlocks={[{ type: 'divider' }]} onChange={onChange} imageUpload={{ uploadImage }} />);

    fireEvent.drop(
      screen.getByRole('main', { name: 'Block preview' }),
      fileDrag([png('kickoff.png'), png('team.png')])
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([
        { type: 'divider' },
        { type: 'image', image_url: 'https://files.example.com/kickoff.png', alt_text: 'kickoff' },
        { type: 'image', image_url: 'https://files.example.com/team.png', alt_text: 'team' }
      ])
    );
  });

  it('adds the files that uploaded and names the ones that did not', async () => {
    const uploadImage = vi
      .fn<ImageUploadConfig['uploadImage']>()
      .mockResolvedValueOnce({ url: UPLOADED_URL })
      .mockRejectedValueOnce(new Error('Upload failed'));
    const onChange = vi.fn<(blocks: SupportedBlock[]) => void>();
    render(<BlockKitchen onChange={onChange} imageUpload={{ uploadImage }} />);

    fireEvent.drop(screen.getByRole('main', { name: 'Block preview' }), fileDrag([png(), png('broken.png')]));

    expect((await screen.findByRole('alert')).textContent).toContain('Couldn\'t upload "broken.png": Upload failed');
    expect(onChange).toHaveBeenLastCalledWith([{ type: 'image', image_url: UPLOADED_URL, alt_text: 'roadmap' }]);
  });

  it('ignores dropped files when the image block type is disabled', () => {
    const uploadImage = vi.fn<ImageUploadConfig['uploadImage']>();
    render(<BlockKitchen imageUpload={{ uploadImage }} disabledBlockTypes={['image']} />);

    fireEvent.drop(screen.getByRole('main', { name: 'Block preview' }), fileDrag([png()]));

    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('ignores dropped files without the host config', () => {
    const onChange = vi.fn();
    render(<BlockKitchen initialBlocks={[{ type: 'divider' }]} onChange={onChange} />);

    fireEvent.drop(screen.getByRole('main', { name: 'Block preview' }), fileDrag([png()]));

    expect(onChange).not.toHaveBeenCalled();
  });
});
