'use client';

import { useEffect, useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

type CaptchaTheme = 'light' | 'dark';

type FCaptchaRenderOptions = {
  siteKey: string;
  theme?: CaptchaTheme;
  lang?: string;
  responseField?: boolean;
  callback?: (token: string) => void;
  errorCallback?: (reason: unknown) => void;
  expiredCallback?: () => void;
};

type FCaptchaApi = {
  serverUrl?: string;
  render: (container: HTMLElement, options: FCaptchaRenderOptions) => string;
  reset: (widgetId: string) => void;
  destroy: (widgetId: string) => void;
};

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: CaptchaTheme | 'auto';
  language?: string;
  size?: 'normal' | 'flexible' | 'compact';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    FCaptcha?: FCaptchaApi;
    turnstile?: TurnstileApi;
  }
}

type Provider = 'fcaptcha' | 'turnstile';

type CaptchaResponse = { passToken?: string; fallback?: boolean; error?: string } | null;

type Props = {
  purpose: 'sign-up' | 'site-new' | 'blog-post';
  theme?: CaptchaTheme;
  resetKey?: number;
  onPass: (passToken: string) => void;
};

const FCAPTCHA_SERVER_URL = 'https://fcaptcha.webdecoy.com';
const SCRIPT_SOURCES: Record<Provider, string> = {
  fcaptcha: `${FCAPTCHA_SERVER_URL}/fcaptcha.js`,
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
};
const LOAD_FAILED_MESSAGE = '보안 확인을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
const FAILED_MESSAGE = '보안 확인에 실패했습니다. 다시 시도해 주세요.';

const scriptPromises: Partial<Record<Provider, Promise<void>>> = {};

function loadScript(provider: Provider) {
  const isReady = provider === 'fcaptcha' ? Boolean(window.FCaptcha) : Boolean(window.turnstile);

  if (isReady) {
    return Promise.resolve();
  }

  if (!scriptPromises[provider]) {
    scriptPromises[provider] = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SOURCES[provider];
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        delete scriptPromises[provider];
        script.remove();
        reject(new Error(provider));
      };
      document.head.appendChild(script);
    });
  }

  return scriptPromises[provider];
}

async function postCaptcha(body: Record<string, string>) {
  const response = await fetch('/api/captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { ok: response.ok, result: (await response.json().catch(() => null)) as CaptchaResponse };
}

export default function Captcha({ purpose, theme = 'light', resetKey = 0, onPass }: Props) {
  const containerReference = useRef<HTMLDivElement>(null);
  const onPassReference = useRef(onPass);
  const [provider, setProvider] = useState<Provider>('fcaptcha');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    onPassReference.current = onPass;
  }, [onPass]);

  useEffect(() => {
    let widgetId = '';
    let isActive = true;
    const siteKey =
      provider === 'fcaptcha'
        ? process.env.NEXT_PUBLIC_FCAPTCHA_SITE_KEY
        : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    function resetWidget() {
      if (!widgetId) return;
      if (provider === 'fcaptcha') window.FCaptcha?.reset(widgetId);
      else window.turnstile?.reset(widgetId);
    }

    async function requestFallback() {
      if (provider !== 'fcaptcha') {
        setErrorMessage(LOAD_FAILED_MESSAGE);
        return;
      }

      try {
        const { result } = await postCaptcha({ action: 'fallback', purpose });
        if (!isActive) return;

        if (result?.fallback) {
          setErrorMessage('');
          setProvider('turnstile');
          return;
        }

        setErrorMessage(result?.error || LOAD_FAILED_MESSAGE);
        resetWidget();
      } catch {
        if (isActive) setErrorMessage(LOAD_FAILED_MESSAGE);
      }
    }

    async function handleToken(token: string) {
      setErrorMessage('');

      try {
        const { ok, result } = await postCaptcha({ provider, token, purpose });
        if (!isActive) return;

        if (result?.fallback && provider === 'fcaptcha') {
          setProvider('turnstile');
          return;
        }

        if (!ok || !result?.passToken) {
          setErrorMessage(result?.error || FAILED_MESSAGE);
          resetWidget();
          return;
        }

        onPassReference.current(result.passToken);
      } catch {
        if (!isActive) return;
        setErrorMessage('보안 확인에 실패했습니다. 인터넷 연결을 확인해 주세요.');
        resetWidget();
      }
    }

    if (!siteKey) {
      void requestFallback();
      return;
    }

    loadScript(provider)
      .then(() => {
        const container = containerReference.current;
        if (!isActive || !container) return;

        if (provider === 'fcaptcha' && window.FCaptcha) {
          window.FCaptcha.serverUrl = FCAPTCHA_SERVER_URL;
          widgetId = window.FCaptcha.render(container, {
            siteKey,
            theme,
            lang: 'ko',
            responseField: false,
            callback: (token) => void handleToken(token),
            errorCallback: () => void requestFallback(),
            expiredCallback: () => setErrorMessage(''),
          });
          return;
        }

        if (provider === 'turnstile' && window.turnstile) {
          widgetId = window.turnstile.render(container, {
            sitekey: siteKey,
            theme,
            language: 'ko',
            size: 'flexible',
            callback: (token) => void handleToken(token),
            'expired-callback': () => resetWidget(),
            'error-callback': () => setErrorMessage(LOAD_FAILED_MESSAGE),
          });
          return;
        }

        void requestFallback();
      })
      .catch(() => {
        if (isActive) void requestFallback();
      });

    return () => {
      isActive = false;
      if (!widgetId) return;
      if (provider === 'fcaptcha') window.FCaptcha?.destroy(widgetId);
      else window.turnstile?.remove(widgetId);
    };
  }, [provider, purpose, theme, resetKey]);

  return (
    <div>
      <div ref={containerReference} key={`${provider}-${resetKey}`} />
      {errorMessage ? (
        <p className="alert error" role="alert">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </div>
  );
}
