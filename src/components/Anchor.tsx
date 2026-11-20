import Link from 'next/link';

interface Props extends React.ComponentPropsWithRef<'a'> {
  href: string;
}

const domainRegex = /^https?:\/\/(www\.)?domain\.com\/?/;

export default function Anchor({ href, ref, children, ...rest }: Props) {
  const resolvedHref = domainRegex.test(href) ? href.replace(domainRegex, '/') : href;

  if (resolvedHref.startsWith('/')) {
    return (
      <Link ref={ref} href={resolvedHref} {...rest}>
        {children}
      </Link>
    );
  }

  if (!resolvedHref.startsWith('http')) {
    return (
      <a ref={ref} href={resolvedHref} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a ref={ref} href={resolvedHref} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
      {children}
    </a>
  );
}
