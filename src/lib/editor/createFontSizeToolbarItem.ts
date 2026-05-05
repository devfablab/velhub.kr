import type { PluginContext, PluginInfo, HTMLMdNode } from '@toast-ui/editor';
import type { Context } from '@toast-ui/editor/types/toastmark';

type FontSizePayload = {
  fontSize?: string;
};

type SpanAttrs = {
  htmlAttrs: Record<string, string> | null;
  htmlInline: unknown;
  classNames: string[] | null;
};

const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36];

function createFontSizePopupBody(eventEmitter: PluginContext['eventEmitter']) {
  const popupBody = document.createElement('div');

  popupBody.className = 'toastui-editor-popup-body';

  const list = document.createElement('ul');

  list.setAttribute('aria-label', '글자크기');
  list.setAttribute('aria-role', 'menu');

  FONT_SIZE_OPTIONS.forEach((fontSize) => {
    const item = document.createElement('li');

    item.setAttribute('aria-role', 'menuitem');
    item.dataset.level = String(fontSize);
    item.dataset.type = 'fontSize';

    const label = document.createElement('span');

    label.style.fontSize = `${fontSize}px`;
    label.textContent = `${fontSize}px`;

    item.appendChild(label);

    item.addEventListener('click', () => {
      eventEmitter.emit('command', 'fontSize', {
        fontSize: `${fontSize}px`,
      });

      eventEmitter.emit('closePopup');
    });

    list.appendChild(item);
  });

  popupBody.appendChild(list);

  return popupBody;
}

function createToolbarItem(eventEmitter: PluginContext['eventEmitter']) {
  return {
    name: 'fontSize',
    tooltip: '글자크기',
    className: 'fontSize toastui-editor-toolbar-icons',
    popup: {
      className: 'toastui-editor-popup-add-fontSize',
      body: createFontSizePopupBody(eventEmitter),
      style: {
        width: 'auto',
      },
    },
  };
}

function getSpanAttrs(selection: any): SpanAttrs {
  const slice = selection.content();

  let attrs: SpanAttrs = {
    htmlAttrs: null,
    htmlInline: null,
    classNames: null,
  };

  slice.content.nodesBetween(0, slice.content.size, (node: any) => {
    if (!Array.isArray(node.marks) || node.marks.length === 0) {
      return;
    }

    node.marks.forEach((mark: any) => {
      if (mark.type?.name === 'span') {
        attrs = mark.attrs;
      }
    });
  });

  return attrs;
}

function assignFontSize(previousStyle: string, fontSize: string) {
  if (!previousStyle) {
    return `font-size: ${fontSize};`;
  }

  if (!previousStyle.includes('font-size')) {
    return `font-size: ${fontSize}; ${previousStyle}`;
  }

  return previousStyle
    .split(';')
    .map((style) => {
      if (style.includes('font-size')) {
        return `font-size: ${fontSize}`;
      }

      return style;
    })
    .filter(Boolean)
    .join(';');
}

function createSelection(tr: any, selection: any, SelectionClass: any, openTag: string, closeTag: string) {
  const { mapping, doc } = tr;
  const { from, to, empty } = selection;
  const mappedFrom = mapping.map(from) + openTag.length;
  const mappedTo = mapping.map(to) - closeTag.length;

  return empty ? SelectionClass.create(doc, mappedTo, mappedTo) : SelectionClass.create(doc, mappedFrom, mappedTo);
}

export function fontSizePlugin(context: PluginContext): PluginInfo {
  const { eventEmitter, pmState } = context;
  const toolbarItem = createToolbarItem(eventEmitter);

  return {
    markdownCommands: {
      fontSize: ({ fontSize }: FontSizePayload, { tr, selection, schema }, dispatch) => {
        if (!fontSize) {
          return false;
        }

        const slice = selection.content();
        const textContent = slice.content.textBetween(0, slice.content.size, '\n');
        const openTag = `<span style="font-size: ${fontSize};">`;
        const closeTag = '</span>';
        const fontSized = `${openTag}${textContent}${closeTag}`;

        tr.replaceSelectionWith(schema.text(fontSized)).setSelection(
          createSelection(tr, selection, pmState.TextSelection, openTag, closeTag),
        );

        dispatch?.(tr);

        return true;
      },
    },

    wysiwygCommands: {
      fontSize: ({ fontSize }: FontSizePayload, { tr, selection, schema }, dispatch) => {
        if (!fontSize || selection.empty) {
          return false;
        }

        const { from, to } = selection;
        const previousAttrs = getSpanAttrs(selection);
        const previousStyle = previousAttrs.htmlAttrs?.style ?? '';
        const style = assignFontSize(previousStyle, fontSize);

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
        itemIndex: 0,
        item: toolbarItem,
      },
    ],

    toHTMLRenderers: {
      htmlInline: {
        span(node: HTMLMdNode, { entering }: Context) {
          return entering
            ? {
                type: 'openTag',
                tagName: 'span',
                attributes: node.attrs ?? {},
              }
            : {
                type: 'closeTag',
                tagName: 'span',
              };
        },
      },
    },
  };
}
