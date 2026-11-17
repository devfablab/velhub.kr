import Link from 'next/link';

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

const domainRegex = /http[s]*:\/\/[www.]*domain\.com[/]?/;

export default function Anchor({ href, className, children, ...rest }: Props) {
  const isSameDomain = domainRegex.test(href);
  let resolvedHref = href;

  if (isSameDomain) {
    resolvedHref = resolvedHref.replace(domainRegex, '/');
  }

  if (resolvedHref.startsWith('/')) {
    return (
      <Link href={resolvedHref} className={className} {...rest}>
        {children}
      </Link>
    );
  }

  if (!resolvedHref.startsWith('http')) {
    return (
      <a href={resolvedHref} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a href={resolvedHref} className={className} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
      {children}
    </a>
  );
}
