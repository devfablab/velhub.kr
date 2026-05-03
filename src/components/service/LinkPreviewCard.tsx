import Anchor from '../Anchor';
import styles from '@/app/linkPreview.module.sass';

type LinkPreviewCardProps = {
  siteName: string | null;
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  href: string;
  debug?: {
    stage: string;
    message: string;
    requestUrl?: string;
    finalUrl?: string;
    externalStatus?: number;
    externalStatusText?: string;
    externalContentType?: string | null;
    externalBodySample?: string;
  };
};

function getDisplayDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function LinkPreviewCard({ siteName, title, description, image, href, debug }: LinkPreviewCardProps) {
  if (!href) {
    return null;
  }

  const displayDomain = getDisplayDomain(href);
  const shouldShowSiteName = Boolean(siteName && siteName !== displayDomain);

  return (
    <div className={styles['link-preview']}>
      <Anchor href={href}>
        {image ? (
          <div className={styles.thumbnail}>
            <img src={image} alt="" width={1200} height={630} />
          </div>
        ) : null}

        <div className={styles.info}>
          {title ? <strong>{title}</strong> : null}
          {description ? <p>{description}</p> : null}
          <div className={styles.site}>
            {shouldShowSiteName ? <cite>{siteName}</cite> : null}
            <em>{displayDomain}</em>
          </div>
          {/* <pre>{JSON.stringify(debug, null, 2)}</pre> */}
        </div>
      </Anchor>
    </div>
  );
}
