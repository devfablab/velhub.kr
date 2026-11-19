export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID;

type EventProps = {
  action: string;
  category: string;
  label: string;
  value: string | number;
};

type GoogleTag = (command: string, ...argumentsList: unknown[]) => void;

export const pageview = (url: string) => {
  const googleTag = typeof window === 'undefined' ? undefined : (window as Window & { gtag?: GoogleTag }).gtag;

  if (typeof googleTag === 'function') {
    googleTag('config', GA_TRACKING_ID as string, {
      page_path: url,
    });
  }
};

export const event = ({ action, category, label, value }: EventProps): void => {
  const googleTag = typeof window === 'undefined' ? undefined : (window as Window & { gtag?: GoogleTag }).gtag;

  if (typeof googleTag === 'function') {
    googleTag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};
