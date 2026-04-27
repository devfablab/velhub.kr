import Link from 'next/link';

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

const domainRegex = /http[s]*:\/\/[www.]*domain\.com[/]?/;

export default function Anchor({ href, className, children, ...rest }: Props) {
  const sameDomain = domainRegex.test(href);
  let h = href;

  if (sameDomain) {
    h = h.replace(domainRegex, '/');
  }

  if (h.startsWith('/')) {
    return (
      <Link href={h} className={className} {...rest}>
        {children}
      </Link>
    );
  }

  if (!h.startsWith('http')) {
    return (
      <a href={h} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a href={h} className={className} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
      {children}
    </a>
  );
}
