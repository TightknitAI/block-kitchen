import type { SupportedBlock, Template } from '@tightknitai/block-kitchen';

/**
 * Demo-specific template gallery. The `block-kitchen` package intentionally
 * does **not** ship templates of its own — templates are use-case examples
 * (an "Expense approval" is for an approvals product, a "Daily standup" is
 * for a team product) and belong in the consuming app's config, not the
 * library bundle. This file is the demo's own config; downstream apps are
 * expected to define their own set and pass it to `<TemplatePicker>`.
 *
 * The set is intentionally broad to showcase the platform in the live demo
 * — between them the templates exercise every supported block type and a
 * wide slice of the element catalog (every select type, all date/time
 * pickers, every text-input variant, file input, rich text input, feedback
 * / icon buttons, image accessories, overflow menus, button confirm
 * dialogs).
 *
 * Each template's `surface` is the surface its blocks were authored for;
 * the runtime validator enforces surface compatibility (e.g. `alert` is
 * modal-only, `table` / `markdown` / `carousel` / `context_actions` are
 * forbidden on modals, `table` / `markdown` / `context_actions` are
 * forbidden on app-home tabs), and the templates here respect those rules.
 */

/**
 * Categories used to group templates in the demo's `<TemplatePicker>`.
 */
const TEMPLATE_CATEGORIES = {
  engineering: 'Engineering',
  approvals: 'Approvals',
  team: 'Team',
  announcements: 'Announcements',
  forms: 'Forms',
  scheduling: 'Scheduling',
  homeTabs: 'Home tabs'
} as const;

// --- Template 1: Pull request review (message) -----------------------------

const PR_REVIEW_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Pull request ready for review', emoji: true }
  },
  {
    type: 'context',
    elements: [
      {
        type: 'image',
        image_url: 'https://placehold.co/24x24/4f46e5/ffffff?text=AK',
        alt_text: 'Avatar'
      },
      {
        type: 'mrkdwn',
        text: '*Aisha Khan* opened <https://github.com/example/payments/pull/482|#482> in <https://github.com/example/payments|example/payments> · 3 minutes ago'
      }
    ]
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*<https://github.com/example/payments/pull/482|Reconcile webhook retries on idempotency key>* \n_Backports the deterministic retry helper so duplicate `payment.succeeded` events resolve to a single ledger entry. Closes #471._'
    },
    accessory: {
      type: 'image',
      image_url: 'https://placehold.co/64x64/0ea5e9/ffffff?text=PR',
      alt_text: 'Repository icon'
    }
  },
  {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_preformatted',
        elements: [
          {
            type: 'text',
            text: '- async function handleWebhook(event) {\n-   await ledger.insert(event);\n+ async function handleWebhook(event) {\n+   const key = idempotencyKey(event);\n+   await ledger.upsert(key, event);\n+ }'
          }
        ]
      }
    ]
  },
  {
    type: 'table',
    column_settings: [{ align: 'left' }, { align: 'right' }, { align: 'right' }, { align: 'center' }],
    rows: [
      [
        { type: 'raw_text', text: 'File' },
        { type: 'raw_text', text: 'Added' },
        { type: 'raw_text', text: 'Removed' },
        { type: 'raw_text', text: 'CI' }
      ],
      [
        { type: 'raw_text', text: 'src/webhooks/handler.ts' },
        { type: 'raw_text', text: '+42' },
        { type: 'raw_text', text: '−18' },
        { type: 'raw_text', text: '✅' }
      ],
      [
        { type: 'raw_text', text: 'src/lib/idempotency.ts' },
        { type: 'raw_text', text: '+96' },
        { type: 'raw_text', text: '−0' },
        { type: 'raw_text', text: '✅' }
      ],
      [
        { type: 'raw_text', text: 'test/webhooks.test.ts' },
        { type: 'raw_text', text: '+128' },
        { type: 'raw_text', text: '−4' },
        { type: 'raw_text', text: '✅' }
      ]
    ]
  },
  { type: 'divider' },
  {
    type: 'actions',
    elements: [
      {
        type: 'users_select',
        action_id: 'pr_review_reviewer',
        placeholder: { type: 'plain_text', text: 'Pick a reviewer', emoji: true }
      },
      {
        type: 'button',
        action_id: 'pr_review_view',
        text: { type: 'plain_text', text: 'View pull request', emoji: true },
        url: 'https://github.com/example/payments/pull/482',
        style: 'primary'
      },
      {
        type: 'overflow',
        action_id: 'pr_review_overflow',
        options: [
          {
            text: { type: 'plain_text', text: 'Mute thread', emoji: true },
            value: 'mute'
          },
          {
            text: { type: 'plain_text', text: 'Reassign', emoji: true },
            value: 'reassign'
          },
          {
            text: { type: 'plain_text', text: 'Copy link', emoji: true },
            value: 'copy_link'
          }
        ]
      }
    ]
  },
  {
    type: 'context_actions',
    elements: [
      {
        type: 'feedback_buttons',
        action_id: 'pr_review_feedback',
        positive_button: {
          text: { type: 'plain_text', text: 'Looks good' },
          value: 'positive'
        },
        negative_button: {
          text: { type: 'plain_text', text: 'Needs work' },
          value: 'negative'
        }
      },
      {
        type: 'icon_button',
        action_id: 'pr_review_remove',
        icon: 'trash',
        text: { type: 'plain_text', text: 'Dismiss' }
      }
    ]
  }
];

// --- Template 2: Incident report (message) ---------------------------------

const INCIDENT_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'INC-2419 · Checkout latency spike', emoji: true }
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '🔴 *SEV-2* · Investigating · Commander: <@U02INCCMDR> · Started 18 min ago'
      }
    ]
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Summary*\np95 checkout latency rose from 240ms to 3.1s starting at 14:02 UTC. The spike correlates with the rollout of `payments-svc@v412` to the `us-east-1` cell. Customer-facing impact is limited to the EU and US regions; cart submissions are succeeding after retry.'
    }
  },
  {
    type: 'table',
    column_settings: [{ align: 'left' }, { align: 'left' }, { align: 'left' }],
    rows: [
      [
        { type: 'raw_text', text: 'Time (UTC)' },
        { type: 'raw_text', text: 'Event' },
        { type: 'raw_text', text: 'Owner' }
      ],
      [
        { type: 'raw_text', text: '14:02' },
        { type: 'raw_text', text: 'Latency alert fired on /checkout' },
        { type: 'raw_text', text: 'PagerDuty' }
      ],
      [
        { type: 'raw_text', text: '14:06' },
        { type: 'raw_text', text: 'Paged on-call, rolled war room' },
        { type: 'raw_text', text: 'Aisha' }
      ],
      [
        { type: 'raw_text', text: '14:11' },
        { type: 'raw_text', text: 'Identified payments-svc@v412 rollout' },
        { type: 'raw_text', text: 'Marcus' }
      ],
      [
        { type: 'raw_text', text: '14:18' },
        { type: 'raw_text', text: 'Initiated rollback to v411' },
        { type: 'raw_text', text: 'Marcus' }
      ]
    ]
  },
  { type: 'divider' },
  {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'Next steps', style: { bold: true } }]
      },
      {
        type: 'rich_text_list',
        style: 'bullet',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Watch ' },
              { type: 'text', text: 'rollback', style: { code: true } },
              { type: 'text', text: ' converge across all cells (ETA 15 min).' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Diff the canary metrics for ' },
              { type: 'text', text: 'v411', style: { code: true } },
              { type: 'text', text: ' vs ' },
              { type: 'text', text: 'v412', style: { code: true } },
              { type: 'text', text: ' on the dashboard.' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Open a ' },
              { type: 'text', text: 'post-incident review', style: { italic: true } },
              { type: 'text', text: ' ticket once mitigation is confirmed.' }
            ]
          }
        ]
      }
    ]
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'incident_acknowledge',
        text: { type: 'plain_text', text: 'Acknowledge', emoji: true },
        style: 'primary',
        confirm: {
          title: { type: 'plain_text', text: 'Acknowledge incident?' },
          text: {
            type: 'plain_text',
            text: 'You will be paged for status updates every 15 minutes until mitigation is confirmed.'
          },
          confirm: { type: 'plain_text', text: 'Acknowledge' },
          deny: { type: 'plain_text', text: 'Cancel' }
        }
      },
      {
        type: 'datepicker',
        action_id: 'incident_eta',
        placeholder: { type: 'plain_text', text: 'ETA to mitigation', emoji: true }
      },
      {
        type: 'static_select',
        action_id: 'incident_severity',
        placeholder: { type: 'plain_text', text: 'Change severity', emoji: true },
        initial_option: {
          text: { type: 'plain_text', text: 'SEV-2', emoji: true },
          value: 'sev2'
        },
        options: [
          { text: { type: 'plain_text', text: 'SEV-1', emoji: true }, value: 'sev1' },
          { text: { type: 'plain_text', text: 'SEV-2', emoji: true }, value: 'sev2' },
          { text: { type: 'plain_text', text: 'SEV-3', emoji: true }, value: 'sev3' },
          { text: { type: 'plain_text', text: 'SEV-4', emoji: true }, value: 'sev4' }
        ]
      }
    ]
  }
];

// --- Template 3: Expense approval (message) --------------------------------

const EXPENSE_APPROVAL_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Expense report awaiting your approval', emoji: true }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Submitted by:* <@U07SAVANNAH>\n*Trip:* Q1 customer offsite — Austin, TX\n*Submitted:* Mar 12, 2026 · Auto-categorized as *Travel & Entertainment*'
    },
    accessory: {
      type: 'image',
      image_url: 'https://placehold.co/96x96/16a34a/ffffff?text=Receipt',
      alt_text: 'Receipt thumbnail'
    }
  },
  {
    type: 'table',
    column_settings: [{ align: 'left' }, { align: 'left' }, { align: 'right' }],
    rows: [
      [
        { type: 'raw_text', text: 'Item' },
        { type: 'raw_text', text: 'Vendor' },
        { type: 'raw_text', text: 'Amount' }
      ],
      [
        { type: 'raw_text', text: 'Flight (SFO→AUS)' },
        { type: 'raw_text', text: 'United' },
        { type: 'raw_text', text: '$418.20' }
      ],
      [
        { type: 'raw_text', text: 'Hotel (3 nights)' },
        { type: 'raw_text', text: 'Marriott' },
        { type: 'raw_text', text: '$612.00' }
      ],
      [
        { type: 'raw_text', text: 'Customer dinner' },
        { type: 'raw_text', text: 'Franklin BBQ' },
        { type: 'raw_text', text: '$184.50' }
      ],
      [
        { type: 'raw_text', text: 'Rideshare (4 trips)' },
        { type: 'raw_text', text: 'Uber' },
        { type: 'raw_text', text: '$87.30' }
      ]
    ]
  },
  { type: 'divider' },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Total:* $1,302.00 USD\n*Policy:* Under T&E cap of $1,500 · <https://example.com/policies/travel|view policy>'
    }
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'expense_approve',
        text: { type: 'plain_text', text: 'Approve', emoji: true },
        style: 'primary',
        value: 'approve'
      },
      {
        type: 'button',
        action_id: 'expense_reject',
        text: { type: 'plain_text', text: 'Reject', emoji: true },
        style: 'danger',
        value: 'reject',
        confirm: {
          title: { type: 'plain_text', text: 'Reject this expense?' },
          text: {
            type: 'plain_text',
            text: "The submitter will be notified and asked to revise. You'll be able to leave a comment on the next screen."
          },
          confirm: { type: 'plain_text', text: 'Reject' },
          deny: { type: 'plain_text', text: 'Cancel' },
          style: 'danger'
        }
      },
      {
        type: 'button',
        action_id: 'expense_view_receipts',
        text: { type: 'plain_text', text: 'View receipts', emoji: true },
        url: 'https://example.com/expenses/EX-9182/receipts'
      }
    ]
  }
];

// --- Template 4: Daily standup (message) -----------------------------------

const STANDUP_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Daily standup — Platform team', emoji: true }
  },
  {
    type: 'context',
    elements: [
      {
        type: 'image',
        image_url: 'https://placehold.co/24x24/f97316/ffffff?text=JD',
        alt_text: 'Avatar'
      },
      { type: 'mrkdwn', text: '*Jordan Diaz* · Tuesday, March 17, 2026' }
    ]
  },
  {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'Yesterday', style: { bold: true } }]
      },
      {
        type: 'rich_text_list',
        style: 'bullet',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Shipped the retry helper behind ' },
              { type: 'text', text: 'payments_retry_v2', style: { code: true } },
              { type: 'text', text: ' (10% canary).' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Pair-debugged the flaky integration test with ' },
              { type: 'text', text: '@aisha', style: { bold: true } },
              { type: 'text', text: '.' }
            ]
          }
        ]
      },
      {
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'Today', style: { bold: true } }]
      },
      {
        type: 'rich_text_list',
        style: 'bullet',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Roll out ' },
              { type: 'text', text: 'payments_retry_v2', style: { code: true } },
              { type: 'text', text: ' to 50% if canary metrics stay healthy.' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Write the ' },
              {
                type: 'link',
                url: 'https://example.com/rfcs/idempotency-cache',
                text: 'idempotency cache RFC'
              },
              { type: 'text', text: '.' }
            ]
          }
        ]
      },
      {
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'Blockers', style: { bold: true } }]
      },
      {
        type: 'rich_text_list',
        style: 'bullet',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Need a review on ' },
              {
                type: 'link',
                url: 'https://github.com/example/payments/pull/482',
                text: '#482'
              },
              { type: 'text', text: ' before I can roll forward.' }
            ]
          }
        ]
      }
    ]
  },
  { type: 'divider' },
  {
    type: 'actions',
    elements: [
      {
        type: 'datepicker',
        action_id: 'standup_date',
        placeholder: { type: 'plain_text', text: 'Pick a date', emoji: true }
      },
      {
        type: 'multi_users_select',
        action_id: 'standup_blocked_by',
        placeholder: { type: 'plain_text', text: 'Blocked by…', emoji: true }
      }
    ]
  },
  {
    type: 'context_actions',
    elements: [
      {
        type: 'feedback_buttons',
        action_id: 'standup_feedback',
        positive_button: {
          text: { type: 'plain_text', text: '👍' },
          value: 'positive'
        },
        negative_button: {
          text: { type: 'plain_text', text: '👎' },
          value: 'negative'
        }
      }
    ]
  }
];

// --- Template 5: Product release (message) ---------------------------------

const PRODUCT_RELEASE_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Acme v2.5 is live 🎉', emoji: true }
  },
  {
    type: 'image',
    image_url: 'https://placehold.co/1200x420/6366f1/ffffff?text=Acme+v2.5',
    alt_text: 'Acme v2.5 release banner',
    title: { type: 'plain_text', text: 'What shipped this month', emoji: true }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: "The biggest release of the quarter — *bulk edit*, a redesigned inbox, and the new *Insights* panel. Here's the long-form rundown."
    }
  },
  {
    type: 'markdown',
    text: '## Highlights\n\n- **Bulk edit** — multi-select rows and apply changes inline (Cmd-click to extend).\n- **Inbox 2.0** — threaded conversations, snooze, and saved-views in the sidebar.\n- **Insights** — first-class dashboards for response time, escalations, and CSAT.\n\n## Compatibility\n\n| Surface | Supported | Notes |\n| --- | --- | --- |\n| Web | ✅ | Rolling out over 48h |\n| iOS 17+ | ✅ | App Store update required |\n| Desktop | ✅ | Auto-updates on next restart |\n| Slack app | ✅ | New `/acme inbox` command |\n\nUpgrade is automatic — no migration steps required.'
  },
  { type: 'divider' },
  {
    type: 'carousel',
    elements: [
      {
        type: 'card',
        hero_image: {
          type: 'image',
          image_url: 'https://placehold.co/600x300/4f46e5/ffffff?text=Bulk+edit',
          alt_text: 'Bulk edit screenshot'
        },
        title: { type: 'mrkdwn', text: '*Bulk edit*' },
        body: {
          type: 'mrkdwn',
          text: 'Select dozens of rows and apply changes in one shot. Shift-click to extend a range.'
        },
        actions: [
          {
            type: 'button',
            action_id: 'release_card_bulk_edit',
            text: { type: 'plain_text', text: 'Read the guide', emoji: true },
            url: 'https://example.com/docs/bulk-edit'
          }
        ]
      },
      {
        type: 'card',
        hero_image: {
          type: 'image',
          image_url: 'https://placehold.co/600x300/0ea5e9/ffffff?text=Inbox+2.0',
          alt_text: 'Inbox 2.0 screenshot'
        },
        title: { type: 'mrkdwn', text: '*Inbox 2.0*' },
        body: {
          type: 'mrkdwn',
          text: 'Threaded conversations, snooze, and saved-views — all in a redesigned sidebar.'
        },
        actions: [
          {
            type: 'button',
            action_id: 'release_card_inbox',
            text: { type: 'plain_text', text: 'Watch the demo', emoji: true },
            url: 'https://example.com/demos/inbox'
          }
        ]
      },
      {
        type: 'card',
        hero_image: {
          type: 'image',
          image_url: 'https://placehold.co/600x300/16a34a/ffffff?text=Insights',
          alt_text: 'Insights screenshot'
        },
        title: { type: 'mrkdwn', text: '*Insights*' },
        body: {
          type: 'mrkdwn',
          text: 'First-class dashboards for response time, escalations, and CSAT — opt in from Settings → Beta.'
        },
        actions: [
          {
            type: 'button',
            action_id: 'release_card_insights',
            text: { type: 'plain_text', text: 'Open Insights', emoji: true },
            url: 'https://example.com/insights'
          }
        ]
      }
    ]
  },
  {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '*Acme v2.5* · Released by <@U02PRODUCT> · March 17, 2026' }]
  }
];

// --- Template 6: Customer feedback intake (modal) --------------------------

const FEEDBACK_INTAKE_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Send us feedback', emoji: true }
  },
  {
    type: 'alert',
    level: 'info',
    text: {
      type: 'mrkdwn',
      text: 'Thanks for taking the time — every field below is optional except *Subject* and *Category*. We read every submission.'
    }
  },
  { type: 'divider' },
  {
    type: 'input',
    block_id: 'feedback_subject',
    label: { type: 'plain_text', text: 'Subject', emoji: true },
    element: {
      type: 'plain_text_input',
      action_id: 'feedback_subject_input',
      placeholder: {
        type: 'plain_text',
        text: 'One sentence on what this is about',
        emoji: true
      },
      max_length: 120
    }
  },
  {
    type: 'input',
    block_id: 'feedback_category',
    label: { type: 'plain_text', text: 'Category', emoji: true },
    element: {
      type: 'static_select',
      action_id: 'feedback_category_select',
      placeholder: { type: 'plain_text', text: 'Pick one', emoji: true },
      options: [
        { text: { type: 'plain_text', text: 'Bug report', emoji: true }, value: 'bug' },
        {
          text: { type: 'plain_text', text: 'Feature request', emoji: true },
          value: 'feature'
        },
        {
          text: { type: 'plain_text', text: 'Question / how-do-I', emoji: true },
          value: 'question'
        },
        {
          text: { type: 'plain_text', text: 'Account / billing', emoji: true },
          value: 'billing'
        },
        { text: { type: 'plain_text', text: 'Other', emoji: true }, value: 'other' }
      ]
    }
  },
  {
    type: 'input',
    block_id: 'feedback_tags',
    label: { type: 'plain_text', text: 'Tags', emoji: true },
    optional: true,
    element: {
      type: 'multi_static_select',
      action_id: 'feedback_tags_select',
      placeholder: { type: 'plain_text', text: 'Pick any that apply', emoji: true },
      max_selected_items: 5,
      options: [
        { text: { type: 'plain_text', text: 'iOS', emoji: true }, value: 'ios' },
        { text: { type: 'plain_text', text: 'Android', emoji: true }, value: 'android' },
        { text: { type: 'plain_text', text: 'Web', emoji: true }, value: 'web' },
        { text: { type: 'plain_text', text: 'Desktop', emoji: true }, value: 'desktop' },
        { text: { type: 'plain_text', text: 'Slack app', emoji: true }, value: 'slack' },
        { text: { type: 'plain_text', text: 'API', emoji: true }, value: 'api' },
        { text: { type: 'plain_text', text: 'Billing', emoji: true }, value: 'billing' }
      ]
    }
  },
  {
    type: 'input',
    block_id: 'feedback_severity',
    label: { type: 'plain_text', text: 'How blocking is this?', emoji: true },
    element: {
      type: 'radio_buttons',
      action_id: 'feedback_severity_radio',
      options: [
        {
          text: { type: 'plain_text', text: 'Hard blocker — I cannot work', emoji: true },
          value: 'blocker'
        },
        {
          text: { type: 'plain_text', text: 'Annoying but I have a workaround', emoji: true },
          value: 'workaround'
        },
        {
          text: { type: 'plain_text', text: 'Nice to have', emoji: true },
          value: 'nice_to_have'
        }
      ]
    }
  },
  {
    type: 'input',
    block_id: 'feedback_areas',
    label: { type: 'plain_text', text: 'Affected areas', emoji: true },
    optional: true,
    element: {
      type: 'checkboxes',
      action_id: 'feedback_areas_check',
      options: [
        { text: { type: 'plain_text', text: 'Inbox', emoji: true }, value: 'inbox' },
        { text: { type: 'plain_text', text: 'Insights', emoji: true }, value: 'insights' },
        { text: { type: 'plain_text', text: 'Bulk edit', emoji: true }, value: 'bulk' },
        { text: { type: 'plain_text', text: 'Notifications', emoji: true }, value: 'notif' }
      ]
    }
  },
  {
    type: 'input',
    block_id: 'feedback_description',
    label: { type: 'plain_text', text: 'Tell us more', emoji: true },
    optional: true,
    element: {
      type: 'rich_text_input',
      action_id: 'feedback_description_rich',
      placeholder: {
        type: 'plain_text',
        text: 'Steps to reproduce, screenshots, or context',
        emoji: true
      }
    }
  },
  {
    type: 'input',
    block_id: 'feedback_attachments',
    label: { type: 'plain_text', text: 'Screenshots', emoji: true },
    optional: true,
    element: {
      type: 'file_input',
      action_id: 'feedback_attachments_file',
      max_files: 3
    }
  },
  {
    type: 'input',
    block_id: 'feedback_contact',
    label: { type: 'plain_text', text: 'Best email to reach you', emoji: true },
    optional: true,
    element: {
      type: 'email_text_input',
      action_id: 'feedback_contact_email',
      placeholder: { type: 'plain_text', text: 'name@example.com', emoji: true }
    }
  }
];

// --- Template 7: Schedule meeting (modal) ----------------------------------

const SCHEDULE_MEETING_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Schedule a meeting', emoji: true }
  },
  {
    type: 'alert',
    level: 'info',
    text: {
      type: 'mrkdwn',
      text: "Attendees will get a calendar invite and a heads-up in the channel you pick. Times are local to each attendee's calendar."
    }
  },
  {
    type: 'input',
    block_id: 'meeting_title',
    label: { type: 'plain_text', text: 'Title', emoji: true },
    element: {
      type: 'plain_text_input',
      action_id: 'meeting_title_input',
      placeholder: {
        type: 'plain_text',
        text: 'Q2 planning sync',
        emoji: true
      },
      max_length: 80
    }
  },
  {
    type: 'input',
    block_id: 'meeting_attendees',
    label: { type: 'plain_text', text: 'Attendees', emoji: true },
    element: {
      type: 'multi_users_select',
      action_id: 'meeting_attendees_select',
      placeholder: { type: 'plain_text', text: 'Pick people', emoji: true },
      max_selected_items: 12
    }
  },
  {
    type: 'input',
    block_id: 'meeting_date',
    label: { type: 'plain_text', text: 'Date', emoji: true },
    element: {
      type: 'datepicker',
      action_id: 'meeting_date_picker'
    }
  },
  {
    type: 'input',
    block_id: 'meeting_time',
    label: { type: 'plain_text', text: 'Start time', emoji: true },
    element: {
      type: 'timepicker',
      action_id: 'meeting_time_picker'
    }
  },
  {
    type: 'input',
    block_id: 'meeting_duration',
    label: { type: 'plain_text', text: 'Duration (minutes)', emoji: true },
    element: {
      type: 'number_input',
      action_id: 'meeting_duration_input',
      is_decimal_allowed: false,
      min_value: '15',
      max_value: '240',
      initial_value: '30'
    }
  },
  {
    type: 'input',
    block_id: 'meeting_channel',
    label: { type: 'plain_text', text: 'Notify channel', emoji: true },
    optional: true,
    element: {
      type: 'channels_select',
      action_id: 'meeting_channel_select',
      placeholder: { type: 'plain_text', text: 'Optional', emoji: true }
    }
  },
  {
    type: 'input',
    block_id: 'meeting_link',
    label: { type: 'plain_text', text: 'Video link', emoji: true },
    optional: true,
    element: {
      type: 'url_text_input',
      action_id: 'meeting_link_input',
      placeholder: {
        type: 'plain_text',
        text: 'https://meet.example.com/...',
        emoji: true
      }
    }
  },
  {
    type: 'input',
    block_id: 'meeting_agenda',
    label: { type: 'plain_text', text: 'Agenda', emoji: true },
    optional: true,
    element: {
      type: 'rich_text_input',
      action_id: 'meeting_agenda_rich',
      placeholder: {
        type: 'plain_text',
        text: 'A few bullets are plenty',
        emoji: true
      }
    }
  },
  { type: 'divider' },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: ':lock: Only the people you invite will see this meeting in their calendar.'
      }
    ]
  }
];

// --- Template 8: Confirm destructive action (modal) ------------------------

const CONFIRM_DESTRUCTIVE_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Delete workspace', emoji: true }
  },
  {
    type: 'alert',
    level: 'warning',
    text: {
      type: 'mrkdwn',
      text: '*This action is permanent.* Deleting a workspace removes every channel, message, file, and integration. Exports and audit logs are kept for 30 days, then purged.'
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'You are about to delete *Acme — Marketing*. To confirm, type the workspace name below exactly.'
    }
  },
  {
    type: 'input',
    block_id: 'confirm_workspace_name',
    label: { type: 'plain_text', text: 'Type the workspace name', emoji: true },
    element: {
      type: 'plain_text_input',
      action_id: 'confirm_workspace_name_input',
      placeholder: { type: 'plain_text', text: 'Acme — Marketing', emoji: true }
    }
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Need an export first? <https://example.com/workspaces/export|Generate a workspace export>.'
      }
    ]
  }
];

// --- Template 9: Welcome / onboarding (app_home) ---------------------------

const WELCOME_HOME_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Welcome to Acme for Slack 👋', emoji: true }
  },
  {
    type: 'image',
    image_url: 'https://placehold.co/1200x320/6366f1/ffffff?text=Welcome+to+Acme',
    alt_text: 'Welcome hero illustration'
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: "*You're almost set up.* Knock out the three steps below and your team will start getting Acme updates right in Slack."
    }
  },
  { type: 'divider' },
  {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_section',
        elements: [{ type: 'text', text: 'Getting started', style: { bold: true } }]
      },
      {
        type: 'rich_text_list',
        style: 'ordered',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Connect your Acme workspace ', style: { bold: true } },
              { type: 'text', text: '— takes about a minute.' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Pick a default channel ', style: { bold: true } },
              { type: 'text', text: 'for routine updates (you can change this anytime).' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Invite your team ', style: { bold: true } },
              { type: 'text', text: 'with ' },
              { type: 'text', text: '/acme invite', style: { code: true } },
              { type: 'text', text: '.' }
            ]
          }
        ]
      }
    ]
  },
  { type: 'divider' },
  {
    type: 'carousel',
    elements: [
      {
        type: 'card',
        hero_image: {
          type: 'image',
          image_url: 'https://placehold.co/600x300/4f46e5/ffffff?text=Tour',
          alt_text: 'Tour cover'
        },
        title: { type: 'mrkdwn', text: '*Take the 2-minute tour*' },
        body: {
          type: 'mrkdwn',
          text: 'The fastest way to see what Acme + Slack can do.'
        },
        actions: [
          {
            type: 'button',
            action_id: 'home_card_tour',
            text: { type: 'plain_text', text: 'Start tour', emoji: true },
            url: 'https://example.com/tour'
          }
        ]
      },
      {
        type: 'card',
        hero_image: {
          type: 'image',
          image_url: 'https://placehold.co/600x300/0ea5e9/ffffff?text=Templates',
          alt_text: 'Templates cover'
        },
        title: { type: 'mrkdwn', text: '*Try a template*' },
        body: {
          type: 'mrkdwn',
          text: 'Approval flows, incident war rooms, weekly digests — drop-in ready.'
        },
        actions: [
          {
            type: 'button',
            action_id: 'home_card_templates',
            text: { type: 'plain_text', text: 'Browse templates', emoji: true },
            url: 'https://example.com/templates'
          }
        ]
      },
      {
        type: 'card',
        hero_image: {
          type: 'image',
          image_url: 'https://placehold.co/600x300/16a34a/ffffff?text=API',
          alt_text: 'API cover'
        },
        title: { type: 'mrkdwn', text: '*Build your own*' },
        body: {
          type: 'mrkdwn',
          text: 'REST + webhooks for the bespoke flows. SDKs in TypeScript, Python, and Go.'
        },
        actions: [
          {
            type: 'button',
            action_id: 'home_card_api',
            text: { type: 'plain_text', text: 'Read docs', emoji: true },
            url: 'https://example.com/docs/api'
          }
        ]
      }
    ]
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'home_connect',
        text: { type: 'plain_text', text: 'Connect Acme workspace', emoji: true },
        style: 'primary',
        url: 'https://example.com/connect'
      },
      {
        type: 'button',
        action_id: 'home_docs',
        text: { type: 'plain_text', text: 'Read the docs', emoji: true },
        url: 'https://example.com/docs'
      }
    ]
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Need a hand? Reply in <#C0HELP> or email <mailto:help@example.com|help@example.com>.'
      }
    ]
  }
];

// --- Template 10: Team dashboard (app_home) --------------------------------

const TEAM_DASHBOARD_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Platform team — at a glance', emoji: true }
  },
  {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Last updated *just now* · auto-refreshes every 5 min' }]
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*🟢 Healthy*\nAll 4 services within SLO · 12 open PRs · 1 active incident (SEV-3, monitoring)'
    },
    accessory: {
      type: 'image',
      image_url: 'https://placehold.co/72x72/16a34a/ffffff?text=OK',
      alt_text: 'Status indicator'
    }
  },
  { type: 'divider' },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Payments service*\n_p95 latency 220ms · error rate 0.04% · 3 PRs awaiting review_'
    },
    accessory: {
      type: 'button',
      action_id: 'dash_open_payments',
      text: { type: 'plain_text', text: 'Open', emoji: true },
      url: 'https://example.com/projects/payments'
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Identity service*\n_p95 latency 87ms · error rate 0.01% · all PRs merged_'
    },
    accessory: {
      type: 'button',
      action_id: 'dash_open_identity',
      text: { type: 'plain_text', text: 'Open', emoji: true },
      url: 'https://example.com/projects/identity'
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Webhook dispatcher*\n_p95 latency 412ms · error rate 0.18% · monitoring INC-2419_'
    },
    accessory: {
      type: 'overflow',
      action_id: 'dash_webhook_overflow',
      options: [
        {
          text: { type: 'plain_text', text: 'Open project', emoji: true },
          value: 'open'
        },
        {
          text: { type: 'plain_text', text: 'View dashboards', emoji: true },
          value: 'dashboards'
        },
        {
          text: { type: 'plain_text', text: 'Page on-call', emoji: true },
          value: 'page'
        }
      ]
    }
  },
  { type: 'divider' },
  {
    type: 'carousel',
    elements: [
      {
        type: 'card',
        icon: {
          type: 'image',
          image_url: 'https://placehold.co/36x36/4f46e5/ffffff?text=PR',
          alt_text: 'PR icon'
        },
        title: { type: 'mrkdwn', text: '*PR #482* — Reconcile webhook retries' },
        subtitle: { type: 'mrkdwn', text: 'Opened by Aisha · 3m ago' },
        body: {
          type: 'mrkdwn',
          text: 'Needs review before the 50% rollout this afternoon.'
        }
      },
      {
        type: 'card',
        icon: {
          type: 'image',
          image_url: 'https://placehold.co/36x36/f97316/ffffff?text=!',
          alt_text: 'Incident icon'
        },
        title: { type: 'mrkdwn', text: '*INC-2419* — Checkout latency spike' },
        subtitle: { type: 'mrkdwn', text: 'SEV-2 · monitoring rollback' },
        body: {
          type: 'mrkdwn',
          text: 'Mitigation deployed at 14:18 UTC. Watching error budgets for the next 30 min.'
        }
      },
      {
        type: 'card',
        icon: {
          type: 'image',
          image_url: 'https://placehold.co/36x36/16a34a/ffffff?text=OK',
          alt_text: 'Deploy icon'
        },
        title: { type: 'mrkdwn', text: '*Release v412.1*' },
        subtitle: { type: 'mrkdwn', text: 'Deployed · all cells green' },
        body: {
          type: 'mrkdwn',
          text: 'Hotfix for the idempotency-key collision shipped to 100%.'
        }
      }
    ]
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'View the <https://example.com/teams/platform|full team page> · <https://example.com/teams/platform/oncall|on-call schedule>'
      }
    ]
  }
];

/**
 * The full curated template gallery. Order here is the order that the
 * picker renders cards within each category section.
 */
export const demoTemplates: readonly Template[] = [
  {
    id: 'pull-request-review',
    name: 'Pull request review',
    description: 'Diff snippet, file table, reviewer assignment, and feedback buttons.',
    category: TEMPLATE_CATEGORIES.engineering,
    surface: 'message',
    blocks: PR_REVIEW_BLOCKS
  },
  {
    id: 'incident-report',
    name: 'Incident report',
    description: 'War-room update with timeline, next steps, and severity controls.',
    category: TEMPLATE_CATEGORIES.engineering,
    surface: 'message',
    blocks: INCIDENT_BLOCKS
  },
  {
    id: 'expense-approval',
    name: 'Expense approval',
    description: 'Itemized expense report with approve, reject (with confirm), and receipts.',
    category: TEMPLATE_CATEGORIES.approvals,
    surface: 'message',
    blocks: EXPENSE_APPROVAL_BLOCKS
  },
  {
    id: 'daily-standup',
    name: 'Daily standup',
    description: 'Rich-text Yesterday / Today / Blockers with date and "blocked by" picker.',
    category: TEMPLATE_CATEGORIES.team,
    surface: 'message',
    blocks: STANDUP_BLOCKS
  },
  {
    id: 'product-release',
    name: 'Product release',
    description: 'Hero image, markdown release notes, and a feature carousel.',
    category: TEMPLATE_CATEGORIES.announcements,
    surface: 'message',
    blocks: PRODUCT_RELEASE_BLOCKS
  },
  {
    id: 'feedback-intake',
    name: 'Customer feedback intake',
    description: 'Eight-field intake form with attachments, tags, severity, and contact email.',
    category: TEMPLATE_CATEGORIES.forms,
    surface: 'modal',
    blocks: FEEDBACK_INTAKE_BLOCKS
  },
  {
    id: 'schedule-meeting',
    name: 'Schedule meeting',
    description: 'Title, attendees, date / time / duration, notify channel, and rich-text agenda.',
    category: TEMPLATE_CATEGORIES.scheduling,
    surface: 'modal',
    blocks: SCHEDULE_MEETING_BLOCKS
  },
  {
    id: 'confirm-destructive',
    name: 'Confirm destructive action',
    description: 'Warning alert with type-to-confirm guard for an irreversible action.',
    category: TEMPLATE_CATEGORIES.approvals,
    surface: 'modal',
    blocks: CONFIRM_DESTRUCTIVE_BLOCKS
  },
  {
    id: 'home-welcome',
    name: 'Welcome / onboarding',
    description: 'App-home tab with hero, ordered checklist, resource carousel, and CTAs.',
    category: TEMPLATE_CATEGORIES.homeTabs,
    surface: 'app_home',
    blocks: WELCOME_HOME_BLOCKS
  },
  {
    id: 'team-dashboard',
    name: 'Team dashboard',
    description: 'Status overview, per-service rows with button accessories, and a recent-items carousel.',
    category: TEMPLATE_CATEGORIES.homeTabs,
    surface: 'app_home',
    blocks: TEAM_DASHBOARD_BLOCKS
  }
] as const;
