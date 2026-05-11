import type { PluginContext, PluginInfo } from '@toast-ui/editor';

type TextColorPayload = {
  textColor?: string;
};

type SpanAttrs = {
  htmlAttrs: Record<string, string> | null;
  htmlInline: unknown;
  classNames: string[] | null;
};

type MarkLike = {
  type?: {
    name?: string;
  };
  attrs?: unknown;
};

type NodeLike = {
  marks?: MarkLike[];
};

type FragmentLike = {
  size: number;
  textBetween: (from: number, to: number, separator?: string) => string;
  nodesBetween: (from: number, to: number, callback: (node: NodeLike) => void) => void;
};

type SliceLike = {
  content: FragmentLike;
};

type SelectionLike = {
  from: number;
  to: number;
  empty: boolean;
  content: () => SliceLike;
};

type MappingLike = {
  map: (position: number) => number;
};

type TransactionLike = {
  mapping: MappingLike;
  doc: unknown;
  replaceSelectionWith: (node: unknown) => TransactionLike;
  setSelection: (selection: unknown) => TransactionLike;
  addMark: (from: number, to: number, mark: unknown) => TransactionLike;
};

type TextSelectionLike = {
  create: (doc: unknown, from: number, to: number) => unknown;
};

type SchemaLike = {
  text: (value: string) => unknown;
  marks: {
    span: {
      create: (attrs: { htmlAttrs: Record<string, string> }) => unknown;
    };
  };
};

type CommandContextLike = {
  tr: TransactionLike;
  selection: SelectionLike;
  schema: SchemaLike;
};

type CommandDispatchLike = (tr: TransactionLike) => void;

const TEXT_COLOR_OPTIONS = [
  { value: 'inherit', label: '기본색' },
  { value: '#EEB400', label: '노랑' },
  { value: '#007ADB', label: '파랑' },
  { value: '#FF555D', label: '빨강' },
];

function isSpanAttrs(value: unknown): value is SpanAttrs {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const target = value as {
    htmlAttrs?: unknown;
    htmlInline?: unknown;
    classNames?: unknown;
  };

  const isValidHtmlAttrs =
    target.htmlAttrs === null || (typeof target.htmlAttrs === 'object' && !Array.isArray(target.htmlAttrs));

  const isValidClassNames =
    target.classNames === null ||
    (Array.isArray(target.classNames) && target.classNames.every((className) => typeof className === 'string'));

  return isValidHtmlAttrs && isValidClassNames;
}

function createTextColorPopupBody(eventEmitter: PluginContext['eventEmitter']) {
  const popupBody = document.createElement('div');

  popupBody.className = 'toastui-editor-popup-body';

  const list = document.createElement('ul');

  list.setAttribute('aria-label', '글자색 변경');
  list.setAttribute('aria-role', 'menu');

  TEXT_COLOR_OPTIONS.forEach((option) => {
    const item = document.createElement('li');

    item.setAttribute('aria-role', 'menuitem');
    item.dataset.level = option.value;
    item.dataset.type = 'textColor';

    const label = document.createElement('span');

    label.style.color = option.value;
    label.textContent = option.label;

    item.appendChild(label);

    item.addEventListener('click', () => {
      eventEmitter.emit('command', 'textColor', {
        textColor: option.value,
      });

      eventEmitter.emit('closePopup');
    });

    list.appendChild(item);
  });

  popupBody.appendChild(list);

  return popupBody;
}

function createTextColorToolbarItem(eventEmitter: PluginContext['eventEmitter']) {
  return {
    name: 'textColor',
    tooltip: '글자색 변경',
    className: 'textColor toastui-editor-toolbar-icons',
    popup: {
      className: 'toastui-editor-popup-add-textColor',
      body: createTextColorPopupBody(eventEmitter),
      style: {
        width: 'auto',
      },
    },
  };
}

function getSpanAttrs(selection: SelectionLike): SpanAttrs {
  const slice = selection.content();

  let attrs: SpanAttrs = {
    htmlAttrs: null,
    htmlInline: null,
    classNames: null,
  };

  slice.content.nodesBetween(0, slice.content.size, (node) => {
    if (!Array.isArray(node.marks) || node.marks.length === 0) {
      return;
    }

    node.marks.forEach((mark) => {
      if (mark.type?.name === 'span' && isSpanAttrs(mark.attrs)) {
        attrs = mark.attrs;
      }
    });
  });

  return attrs;
}

function assignCssValue(previousStyle: string, propertyName: string, propertyValue: string) {
  if (!previousStyle) {
    return `${propertyName}: ${propertyValue};`;
  }

  if (!previousStyle.includes(propertyName)) {
    return `${propertyName}: ${propertyValue}; ${previousStyle}`;
  }

  return previousStyle
    .split(';')
    .map((style) => {
      if (style.includes(propertyName)) {
        return `${propertyName}: ${propertyValue}`;
      }

      return style;
    })
    .filter(Boolean)
    .join(';');
}

function createSelection(
  tr: TransactionLike,
  selection: SelectionLike,
  SelectionClass: TextSelectionLike,
  openTag: string,
  closeTag: string,
) {
  const { mapping, doc } = tr;
  const { from, to, empty } = selection;
  const mappedFrom = mapping.map(from) + openTag.length;
  const mappedTo = mapping.map(to) - closeTag.length;

  return empty ? SelectionClass.create(doc, mappedTo, mappedTo) : SelectionClass.create(doc, mappedFrom, mappedTo);
}

export function textColorPlugin(context: PluginContext): PluginInfo {
  const { eventEmitter, pmState } = context;
  const textColorToolbarItem = createTextColorToolbarItem(eventEmitter);

  return {
    markdownCommands: {
      textColor: (
        { textColor }: TextColorPayload,
        { tr, selection, schema }: CommandContextLike,
        dispatch?: CommandDispatchLike,
      ) => {
        if (!textColor) {
          return false;
        }

        const slice = selection.content();
        const textContent = slice.content.textBetween(0, slice.content.size, '\n');
        const openTag = `<span style="color: ${textColor};">`;
        const closeTag = '</span>';
        const coloredText = `${openTag}${textContent}${closeTag}`;

        tr.replaceSelectionWith(schema.text(coloredText)).setSelection(
          createSelection(tr, selection, pmState.TextSelection, openTag, closeTag),
        );

        dispatch?.(tr);

        return true;
      },
    },

    wysiwygCommands: {
      textColor: (
        { textColor }: TextColorPayload,
        { tr, selection, schema }: CommandContextLike,
        dispatch?: CommandDispatchLike,
      ) => {
        if (!textColor || selection.empty) {
          return false;
        }

        const { from, to } = selection;
        const previousAttrs = getSpanAttrs(selection);
        const previousStyle = previousAttrs.htmlAttrs?.style ?? '';
        const style = assignCssValue(previousStyle, 'color', textColor);

        const mark = schema.marks.span.create({
          htmlAttrs: {
            ...(previousAttrs.htmlAttrs ?? {}),
            style,
          },
        });

        tr.addMark(from, to, mark);
        dispatch?.(tr);

        return true;
      },
    },

    toolbarItems: [
      {
        groupIndex: 0,
        itemIndex: 1,
        item: textColorToolbarItem,
      },
    ],
  };
}
