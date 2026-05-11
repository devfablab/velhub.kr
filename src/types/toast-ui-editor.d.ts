declare module '@toast-ui/editor' {
  export type PluginContext = {
    eventEmitter: {
      emit: (eventName: string, ...payload: unknown[]) => void;
    };
    pmState: {
      TextSelection: {
        create: (doc: unknown, from: number, to?: number) => unknown;
      };
    };
  };

  export type PluginInfo = {
    markdownCommands?: Record<string, unknown>;
    wysiwygCommands?: Record<string, unknown>;
    toolbarItems?: Array<{
      groupIndex: number;
      itemIndex: number;
      item: unknown;
    }>;
    toHTMLRenderers?: Record<string, unknown>;
  };

  export type HTMLMdNode = {
    attrs?: Record<string, string>;
    [key: string]: unknown;
  };
}

declare module '@toast-ui/editor/types/toastmark' {
  export type Context = {
    entering: boolean;
  };
}

declare module '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight-all.js' {
  import type { PluginContext, PluginInfo } from '@toast-ui/editor';

  type CodeSyntaxHighlightPluginOptions = {
    highlighter?: unknown;
  };

  export default function codeSyntaxHighlightPlugin(
    context: PluginContext,
    options?: CodeSyntaxHighlightPluginOptions,
  ): PluginInfo;
}
