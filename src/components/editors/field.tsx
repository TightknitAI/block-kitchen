import type { ReactNode } from 'react';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';

/**
 * One labeled form field with inline helper text. Used by every per-block
 * editor so the look-and-feel is consistent.
 * @param props - field props
 * @param props.label - the visible label (plain language)
 * @param props.help - one-line helper text explaining the field
 * @param props.htmlFor - id of the associated input for a11y
 * @param props.children - the input control(s)
 * @returns the rendered labeled field
 */
export function EditorField({
  label,
  help,
  htmlFor,
  children
}: {
  label: string;
  help?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help && <p className="text-[11px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
}

/**
 * Collapsed "Advanced" disclosure holding one identifier field
 * (`block_id` on a block, `action_id` on an interactive element).
 * These are plumbing the builder fills in automatically, so they stay
 * out of the way until someone needs to pin one to a value their app
 * matches on.
 *
 * Native `<details>`, so the open/closed state, the disclosure
 * triangle, and keyboard behavior all come from the browser.
 * @param props - field props
 * @param props.label - the visible label (e.g. "Action ID")
 * @param props.help - one-line helper text explaining the field
 * @param props.htmlFor - id of the input, for a11y
 * @param props.value - current identifier, if set
 * @param props.placeholder - greyed-out example id
 * @param props.onChange - called with the new id, or undefined when cleared
 * @returns the rendered disclosure
 */
export function AdvancedIdField({
  label,
  help,
  htmlFor,
  value,
  placeholder,
  onChange
}: {
  label: string;
  help: string;
  htmlFor: string;
  value: string | undefined;
  placeholder: string;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <details className="rounded-md border bg-muted/20 px-2.5 py-1.5">
      <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
        Advanced
      </summary>
      <div className="pt-2 pb-1">
        <EditorField label={label} help={help} htmlFor={htmlFor}>
          <Input
            id={htmlFor}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </EditorField>
      </div>
    </details>
  );
}
