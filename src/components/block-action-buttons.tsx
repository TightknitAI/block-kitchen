import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/ui/tooltip';
import type { BlockAction, BlockPosition } from '../types';

/**
 * The host's {@link BlockAction} buttons for one block, styled for the row's
 * desktop hover toolbar (`toolbar`, with tooltips) or its mobile inline row
 * (`inline`, larger touch targets). Renders nothing without actions.
 * @param props - button props
 * @param props.actions - the host's block actions
 * @param props.position - where the block sits, passed to each action
 * @param props.variant - which toolbar the buttons sit in
 * @returns the buttons
 */
export function BlockActionButtons({
  actions,
  position,
  variant
}: {
  actions?: readonly BlockAction[];
  position?: BlockPosition;
  variant: 'toolbar' | 'inline';
}) {
  if (!actions?.length || !position) {
    return null;
  }
  return actions.map((action) =>
    variant === 'toolbar' ? (
      <Tooltip key={action.id}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={action.label}
            onClick={() => action.onSelect(position)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5"
          >
            {action.icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{action.label}</TooltipContent>
      </Tooltip>
    ) : (
      <button
        key={action.id}
        type="button"
        aria-label={action.label}
        onClick={() => action.onSelect(position)}
        className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:h-4 [&_svg]:w-4"
      >
        {action.icon}
      </button>
    )
  );
}
