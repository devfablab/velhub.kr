import type { PluginContext, PluginInfo, HTMLMdNode } from '@toast-ui/editor';
import type { Context } from '@toast-ui/editor/types/toastmark';

type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

type TextAlignPayload = {
  textAlign?: TextAlignValue;
};

const TEXT_ALIGN_OPTIONS: { value: TextAlignValue; label: string }[] = [
  { value: 'left', label: '왼쪽 정렬' },
  { value: 'center', label: '가운데 정렬' },
  { value: 'right', label: '오른쪽 정렬' },
  { value: 'justify', label: '양끝 정렬' },
];

function createTextAlignPopupBody(eventEmitter: PluginContext['eventEmitter']) {
  const popupBody = document.createElement('div');

  popupBody.className = 'toastui-editor-popup-body';

  const list = document.createElement('ul');

  list.setAttribute('aria-label', '정렬');
  list.setAttribute('aria-role', 'menu');

  TEXT_ALIGN_OPTIONS.forEach((option) => {
    const item = document.createElement('li');

    item.setAttribute('aria-role', 'menuitem');
    item.dataset.level = option.value;
    item.dataset.type = 'textAlign';

    const label = document.createElement('span');

    label.textContent = option.label;

    item.appendChild(label);

    item.addEventListener('click', () => {
      eventEmitter.emit('command', 'textAlign', {
        textAlign: option.value,
      });

      eventEmitter.emit('closePopup');
    });

    list.appendChild(item);
  });

  popupBody.appendChild(list);

  return popupBody;
}

function createTextAlignToolbarItem(eventEmitter: PluginContext['eventEmitter']) {
  return {
    name: 'textAlign',
    tooltip: '정렬',
    className: 'textAlign toastui-editor-toolbar-icons',
    popup: {
      className: 'toastui-editor-popup-add-textAlign',
      body: createTextAlignPopupBody(eventEmitter),
      style: {
        width: 'auto',
      },
    },
  };
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

function updateParagraphAlign(tr: any, position: number, textAlign: TextAlignValue) {
  const node = tr.doc.nodeAt(position);

  if (!node || node.type.name !== 'paragraph') {
    return false;
  }

  const previousHtmlAttrs = node.attrs?.htmlAttrs ?? {};
  const previousStyle = previousHtmlAttrs.style ?? '';
  const style = assignCssValue(previousStyle, 'text-align', textAlign);

  tr.setNodeMarkup(position, undefined, {
    ...node.attrs,
    htmlAttrs: {
      ...previousHtmlAttrs,
      style,
    },
  });

  return true;
}

function setParagraphTextAlign(tr: any, selection: any, textAlign: TextAlignValue) {
  const paragraphPositions = new Set<number>();

  if (selection.empty) {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);

      if (node.type.name === 'paragraph') {
        paragraphPositions.add(selection.$from.before(depth));
        break;
      }
    }
  } else {
    tr.doc.nodesBetween(selection.from, selection.to, (node: any, position: number) => {
      if (node.type.name === 'paragraph') {
        paragraphPositions.add(position);
      }
    });
  }

  paragraphPositions.forEach((position) => {
    updateParagraphAlign(tr, position, textAlign);
  });

  return paragraphPositions.size > 0;
}

function createSelection(tr: any, selection: any, SelectionClass: any, openTag: string, closeTag: string) {
  const { mapping, doc } = tr;
  const { from, to, empty } = selection;
  const mappedFrom = mapping.map(from) + openTag.length;
  const mappedTo = mapping.map(to) - closeTag.length;

  return empty ? SelectionClass.create(doc, mappedTo, mappedTo) : SelectionClass.create(doc, mappedFrom, mappedTo);
}

export function textAlignPlugin(context: PluginContext): PluginInfo {
  const { eventEmitter, pmState } = context;
  const textAlignToolbarItem = createTextAlignToolbarItem(eventEmitter);

  return {
    markdownCommands: {
      textAlign: ({ textAlign }: TextAlignPayload, { tr, selection, schema }, dispatch) => {
        if (!textAlign) {
          return false;
        }

        const slice = selection.content();
        const textContent = slice.content.textBetween(0, slice.content.size, '\n');
        const openTag = `<p style="text-align: ${textAlign};">`;
        const closeTag = '</p>';
        const alignedText = `${openTag}${textContent}${closeTag}`;

        tr.replaceSelectionWith(schema.text(alignedText)).setSelection(
          createSelection(tr, selection, pmState.TextSelection, openTag, closeTag),
        );

        dispatch?.(tr);

        return true;
      },
    },

    wysiwygCommands: {
      textAlign: ({ textAlign }: TextAlignPayload, { tr, selection }, dispatch) => {
        if (!textAlign) {
          return false;
        }

        const isUpdated = setParagraphTextAlign(tr, selection, textAlign);

        if (!isUpdated) {
          return false;
        }

        dispatch?.(tr.scrollIntoView());

        return true;
      },
    },

    toolbarItems: [
      {
        groupIndex: 0,
        itemIndex: 4,
        item: textAlignToolbarItem,
      },
    ],

    toHTMLRenderers: {
      paragraph(node: HTMLMdNode, { entering }: Context) {
        return entering
          ? {
              type: 'openTag',
              tagName: 'p',
              attributes: node.attrs ?? {},
            }
          : {
              type: 'closeTag',
              tagName: 'p',
            };
      },
    },
  };
}
