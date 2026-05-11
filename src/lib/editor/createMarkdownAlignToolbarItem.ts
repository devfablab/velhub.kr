import type { HTMLMdNode, PluginContext, PluginInfo } from '@toast-ui/editor';

export type MarkdownAlignValue = 'left' | 'center' | 'right' | 'justify';

type MarkdownAlignPayload = {
  markdownAlign?: MarkdownAlignValue;
};

type ResolvedPositionLike = {
  depth: number;
  doc: {
    resolve: (position: number) => ResolvedPositionLike;
  };
  start: (depth: number) => number;
  end: (depth: number) => number;
};

type SelectionLike = {
  $from: ResolvedPositionLike;
  $to: ResolvedPositionLike;
  from: number;
};

type MappingLike = {
  map: (position: number) => number;
};

type TransactionLike = {
  doc: {
    content: {
      size: number;
    };
  };
  mapping: MappingLike;
  insert: (position: number, node: unknown) => TransactionLike;
  split: (position: number) => TransactionLike;
  setSelection: (selection: unknown) => TransactionLike;
};

type TextSelectionLike = {
  create: (doc: TransactionLike['doc'], from: number, to?: number) => unknown;
};

type SchemaLike = {
  text: (value: string) => unknown;
};

type CommandContextLike = {
  tr: TransactionLike;
  selection: SelectionLike;
  schema: SchemaLike;
};

type CommandDispatchLike = (tr: TransactionLike) => void;

const MARKDOWN_ALIGN_OPTIONS: { value: MarkdownAlignValue; label: string }[] = [
  { value: 'left', label: '왼쪽 정렬' },
  { value: 'center', label: '가운데 정렬' },
  { value: 'right', label: '오른쪽 정렬' },
  { value: 'justify', label: '양끝 정렬' },
];

function normalizeAlignInfo(value: unknown): MarkdownAlignValue | null {
  if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
    return value;
  }

  return null;
}

function createMarkdownAlignPopupBody(eventEmitter: PluginContext['eventEmitter']) {
  const popupBody = document.createElement('div');

  popupBody.className = 'toastui-editor-popup-body';

  const list = document.createElement('ul');

  list.setAttribute('aria-label', '정렬');
  list.setAttribute('role', 'menu');

  MARKDOWN_ALIGN_OPTIONS.forEach((option) => {
    const item = document.createElement('li');

    item.setAttribute('role', 'menuitem');
    item.dataset.level = option.value;
    item.dataset.type = 'markdownAlign';

    const label = document.createElement('span');

    label.textContent = option.label;

    item.appendChild(label);

    item.addEventListener('click', () => {
      eventEmitter.emit('command', 'markdownAlign', {
        markdownAlign: option.value,
      });

      eventEmitter.emit('closePopup');
    });

    list.appendChild(item);
  });

  popupBody.appendChild(list);

  return popupBody;
}

function createMarkdownAlignToolbarItem(eventEmitter: PluginContext['eventEmitter']) {
  return {
    name: 'markdownAlign',
    tooltip: '정렬',
    className: 'textAlign toastui-editor-toolbar-icons',
    popup: {
      className: 'toastui-editor-popup-add-markdownAlign',
      body: createMarkdownAlignPopupBody(eventEmitter),
      style: {
        width: 'auto',
      },
    },
  };
}

function getRangeInfo(selection: SelectionLike) {
  let $from = selection.$from;
  let $to = selection.$to;
  const { from } = selection;
  const doc = $from.doc;

  if ($from.depth === 0) {
    $from = doc.resolve(from - 1);
    $to = $from;
  }

  return {
    startFromOffset: $from.start(1),
    endToOffset: $to.end(1),
  };
}

function createSafeTextSelection(TextSelection: TextSelectionLike, tr: TransactionLike, from: number, to = from) {
  const contentSize = tr.doc.content.size;
  const size = contentSize > 0 ? contentSize - 1 : 1;

  return TextSelection.create(tr.doc, Math.min(from, size), Math.min(to, size));
}

function getCodeBlockInfo(node: HTMLMdNode) {
  const typedNode = node as HTMLMdNode & {
    info?: string | null;
    lang?: string | null;
    language?: string | null;
    attrs?: {
      language?: string | null;
      lang?: string | null;
      info?: string | null;
    };
  };

  return (
    typedNode.info ??
    typedNode.lang ??
    typedNode.language ??
    typedNode.attrs?.language ??
    typedNode.attrs?.lang ??
    typedNode.attrs?.info ??
    null
  );
}

function getCodeBlockContent(node: HTMLMdNode) {
  const typedNode = node as HTMLMdNode & {
    literal?: string;
    text?: string;
    value?: string;
  };

  return typedNode.literal ?? typedNode.text ?? typedNode.value ?? '';
}

export const markdownAlignHTMLRenderer = {
  codeBlock(node: HTMLMdNode) {
    const align = normalizeAlignInfo(getCodeBlockInfo(node));

    if (!align) {
      return [
        {
          type: 'openTag',
          tagName: 'pre',
          outerNewLine: true,
        },
        {
          type: 'openTag',
          tagName: 'code',
        },
        {
          type: 'text',
          content: getCodeBlockContent(node),
        },
        {
          type: 'closeTag',
          tagName: 'code',
        },
        {
          type: 'closeTag',
          tagName: 'pre',
          outerNewLine: true,
        },
      ];
    }

    return [
      {
        type: 'openTag',
        tagName: 'p',
        attributes: {
          style: `text-align: ${align};`,
        },
        outerNewLine: true,
      },
      {
        type: 'text',
        content: getCodeBlockContent(node),
      },
      {
        type: 'closeTag',
        tagName: 'p',
        outerNewLine: true,
      },
    ];
  },
};

export function markdownAlignPlugin(context: PluginContext): PluginInfo {
  const { eventEmitter, pmState } = context;

  return {
    markdownCommands: {
      markdownAlign: (
        { markdownAlign }: MarkdownAlignPayload,
        { tr, selection, schema }: CommandContextLike,
        dispatch?: CommandDispatchLike,
      ) => {
        const align = normalizeAlignInfo(markdownAlign);

        if (!align) {
          return false;
        }

        const { startFromOffset, endToOffset } = getRangeInfo(selection);
        const openTag = `\`\`\`${align}`;
        const closeTag = '```';

        tr.insert(startFromOffset, schema.text(openTag)).split(startFromOffset + openTag.length);

        const mappedEndToOffset = tr.mapping.map(endToOffset);

        tr.split(mappedEndToOffset).insert(tr.mapping.map(endToOffset), schema.text(closeTag));

        dispatch?.(
          tr.setSelection(
            createSafeTextSelection(pmState.TextSelection, tr, tr.mapping.map(endToOffset) - (closeTag.length + 2)),
          ),
        );

        return true;
      },
    },

    toolbarItems: [
      {
        groupIndex: 0,
        itemIndex: 4,
        item: createMarkdownAlignToolbarItem(eventEmitter),
      },
    ],

    toHTMLRenderers: markdownAlignHTMLRenderer,
  };
}
