/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useRef, useState, createElement, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '@mui/material';
import { Viewer } from '@toast-ui/react-editor';
import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight-all.js';
import '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css';
import 'prismjs/themes/prism-okaidia.css';
import '@toast-ui/editor/dist/toastui-editor-viewer.css';
import { Tweet } from 'react-twitter-widgets';
import Vimeo from '@u-wave/react-vimeo';
import { FacebookEmbed, InstagramEmbed } from 'react-social-media-embed';
import { markdownAlignPlugin } from '@/lib/editor/createMarkdownAlignToolbarItem';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import Anchor from '@/components/Anchor';

type Props = {
  html?: string;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  markdownStatus?: string | null;
  themeMode?: 'light' | 'dark';
  className?: string;
};

type EmbedData =
  | {
      type: 'youtube';
      url: string;
      videoId: string;
    }
  | {
      type: 'twitter';
      url: string;
      tweetId: string;
    }
  | {
      type: 'vimeo';
      url: string;
      videoId: string;
    }
  | {
      type: 'instagram';
      url: string;
    }
  | {
      type: 'facebook';
      url: string;
    };

type RenderItem =
  | {
      type: 'nodes';
      nodes: ChildNode[];
    }
  | {
      type: 'embed';
      embed: EmbedData;
    };

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  's',
  'strike',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'span',
  'small',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'figure',
  'figcaption',
  'hr',
]);

function getViewerValue(contentHtml: string | null, contentMarkdown: string | null, markdownStatus: string | null) {
  if (markdownStatus === 'markdown_off') {
    return contentHtml ?? '';
  }

  return contentMarkdown ?? '';
}

function normalizeUrlText(value: string) {
  return value.trim().replace(/&amp;/g, '&');
}

function isUrlText(value: string) {
  return /^https?:\/\/[^\s<>"']+$/i.test(value);
}

function getYoutubeVideoId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v') ?? '';
      }

      if (parsedUrl.pathname.startsWith('/shorts/')) {
        return parsedUrl.pathname.split('/')[2] ?? '';
      }

      if (parsedUrl.pathname.startsWith('/embed/')) {
        return parsedUrl.pathname.split('/')[2] ?? '';
      }
    }

    if (hostname === 'youtu.be') {
      return parsedUrl.pathname.replace('/', '');
    }

    return '';
  } catch {
    return '';
  }
}

function getTweetId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    if (hostname !== 'x.com' && hostname !== 'twitter.com') {
      return '';
    }

    const matchedValue = parsedUrl.pathname.match(/\/status\/(\d+)/);

    return matchedValue?.[1] ?? '';
  } catch {
    return '';
  }
}

function getVimeoVideoId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    if (hostname !== 'vimeo.com' && hostname !== 'player.vimeo.com') {
      return '';
    }

    const matchedValue = parsedUrl.pathname.match(/\/(?:video\/)?(\d+)/);

    return matchedValue?.[1] ?? '';
  } catch {
    return '';
  }
}

function getEmbedData(url: string): EmbedData | null {
  const youtubeVideoId = getYoutubeVideoId(url);

  if (youtubeVideoId) {
    return {
      type: 'youtube',
      url,
      videoId: youtubeVideoId,
    };
  }

  const tweetId = getTweetId(url);

  if (tweetId) {
    return {
      type: 'twitter',
      url,
      tweetId,
    };
  }

  const vimeoVideoId = getVimeoVideoId(url);

  if (vimeoVideoId) {
    return {
      type: 'vimeo',
      url,
      videoId: vimeoVideoId,
    };
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');

    if (hostname === 'instagram.com' && parsedUrl.pathname.startsWith('/p/')) {
      return {
        type: 'instagram',
        url,
      };
    }

    if (hostname === 'facebook.com' || hostname === 'm.facebook.com') {
      return {
        type: 'facebook',
        url,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseStyle(value: string | null) {
  if (!value) {
    return undefined;
  }

  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<CSSProperties>((styleObject, item) => {
      const [propertyName, ...propertyValueParts] = item.split(':');
      const propertyValue = propertyValueParts.join(':').trim();

      if (!propertyName || !propertyValue) {
        return styleObject;
      }

      const camelCasePropertyName = propertyName
        .trim()
        .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof CSSProperties;

      return {
        ...styleObject,
        [camelCasePropertyName]: propertyValue,
      };
    }, {});
}

function getElementProps(element: HTMLElement) {
  const props: Record<string, unknown> = {};

  const className = element.getAttribute('class');
  const style = parseStyle(element.getAttribute('style'));
  const src = element.getAttribute('src');
  const alt = element.getAttribute('alt');
  const colSpan = element.getAttribute('colspan');
  const rowSpan = element.getAttribute('rowspan');

  if (className) {
    props.className = className;
  }

  if (style) {
    props.style = style;
  }

  if (src) {
    props.src = src;
  }

  if (alt !== null) {
    props.alt = alt;
  }

  if (colSpan) {
    props.colSpan = Number(colSpan);
  }

  if (rowSpan) {
    props.rowSpan = Number(rowSpan);
  }

  return props;
}

function renderNode(node: ChildNode, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'a') {
    const href = element.getAttribute('href') ?? '';

    if (!href) {
      return Array.from(element.childNodes).map((childNode, childIndex) =>
        renderNode(childNode, `${key}-${childIndex}`),
      );
    }

    return (
      <Anchor key={key} href={href}>
        {Array.from(element.childNodes).map((childNode, childIndex) => renderNode(childNode, `${key}-${childIndex}`))}
      </Anchor>
    );
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    return Array.from(element.childNodes).map((childNode, childIndex) => renderNode(childNode, `${key}-${childIndex}`));
  }

  if (tagName === 'br' || tagName === 'hr') {
    return createElement(tagName, {
      key,
      ...getElementProps(element),
    });
  }

  if (tagName === 'img') {
    return createElement(tagName, {
      key,

      ...getElementProps(element),
    });
  }

  return createElement(
    tagName,
    {
      key,
      ...getElementProps(element),
    },
    Array.from(element.childNodes).map((childNode, childIndex) => renderNode(childNode, `${key}-${childIndex}`)),
  );
}

function createRenderItems(html: string) {
  if (typeof window === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const documentValue = parser.parseFromString(html, 'text/html');
  const renderItems: RenderItem[] = [];
  let nodeBuffer: ChildNode[] = [];

  function flushNodeBuffer() {
    if (nodeBuffer.length === 0) {
      return;
    }

    renderItems.push({
      type: 'nodes',
      nodes: nodeBuffer,
    });

    nodeBuffer = [];
  }

  Array.from(documentValue.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      if (element.tagName.toLowerCase() === 'p' && !element.querySelector('a')) {
        const urlText = normalizeUrlText(element.textContent ?? '');

        if (isUrlText(urlText)) {
          const embedData = getEmbedData(urlText);

          if (embedData) {
            flushNodeBuffer();

            renderItems.push({
              type: 'embed',
              embed: embedData,
            });

            return;
          }
        }
      }
    }

    nodeBuffer.push(node);
  });

  flushNodeBuffer();

  return renderItems;
}

function EmbeddedRenderedHtml({ html, className }: { html: string; className?: string }) {
  const theme = useTheme();
  const renderItems = useMemo(() => createRenderItems(html), [html]);

  return (
    <>
      {renderItems.map((item, index) => {
        if (item.type === 'nodes') {
          return (
            <div key={`html-${index}`} className={className}>
              {item.nodes.map((node, nodeIndex) => renderNode(node, `${index}-${nodeIndex}`))}
            </div>
          );
        }

        if (item.embed.type === 'youtube') {
          return <YoutubeEmbed key={`embed-${index}`} videoId={item.embed.videoId} />;
        }

        if (item.embed.type === 'twitter') {
          return (
            <Tweet
              key={`embed-${index}`}
              tweetId={item.embed.tweetId}
              options={{
                theme: theme.palette.mode === 'dark' ? 'dark' : 'light',
              }}
            />
          );
        }

        if (item.embed.type === 'vimeo') {
          return <Vimeo key={`embed-${index}`} video={item.embed.videoId} width={1920} height={1080} responsive />;
        }

        if (item.embed.type === 'instagram') {
          return <InstagramEmbed key={`embed-${index}`} url={item.embed.url} width={540} />;
        }

        return <FacebookEmbed key={`embed-${index}`} url={item.embed.url} width={550} />;
      })}
    </>
  );
}

export default function EmbeddedContentHtml({
  html,
  contentHtml = null,
  contentMarkdown = null,
  markdownStatus = null,
  themeMode = 'light',
  className,
}: Props) {
  const viewerWrapperReference = useRef<HTMLDivElement | null>(null);
  const [renderedHtml, setRenderedHtml] = useState('');

  const viewerValue = useMemo(() => {
    if (html !== undefined) {
      return html;
    }

    return getViewerValue(contentHtml, contentMarkdown, markdownStatus);
  }, [html, contentHtml, contentMarkdown, markdownStatus]);

  const plugins = useMemo(() => {
    const nextPlugins = [codeSyntaxHighlight];

    if (markdownStatus === 'markdown_default') {
      nextPlugins.push(markdownAlignPlugin);
    }

    return nextPlugins;
  }, [markdownStatus]);

  const viewerKey = useMemo(() => `${markdownStatus ?? 'html'}-${viewerValue}`, [markdownStatus, viewerValue]);

  useEffect(() => {
    setRenderedHtml('');

    const animationFrameId = window.requestAnimationFrame(() => {
      const viewerContent = viewerWrapperReference.current?.querySelector('.toastui-editor-contents > div');

      setRenderedHtml(viewerContent?.innerHTML ?? '');
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [viewerKey]);

  if (!viewerValue.trim()) {
    return null;
  }

  return (
    <>
      <div ref={viewerWrapperReference} hidden aria-hidden="true">
        <Viewer key={viewerKey} initialValue={viewerValue} plugins={plugins} />
      </div>

      {themeMode === 'light' ? (
        <>{renderedHtml ? <EmbeddedRenderedHtml html={renderedHtml} className={className} /> : null}</>
      ) : (
        <>
          {renderedHtml ? (
            <div className="dark-viewer">
              <EmbeddedRenderedHtml html={renderedHtml} className={className} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
