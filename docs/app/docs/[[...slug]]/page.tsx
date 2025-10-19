import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsPageProps,
  DocsTitle,
} from '@/components/layout/page';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';

type CardProps = {
  title: string;
  href: string;
  children: React.ReactNode;
};

function Card({ title, href, children }: CardProps) {
  return (
    <a
      href={href}
      className="block rounded-lg border border-border p-6 transition-colors hover:border-primary hover:bg-accent no-underline"
    >
      <div className="font-semibold text-lg mb-1">{title}</div>
      <div className="text-muted-foreground text-sm">{children}</div>
    </a>
  );
}

type CardsProps = {
  children: React.ReactNode;
};

function Cards({ children }: CardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">{children}</div>
  );
}

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const { params } = props;
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            Tabs,
            Tab,
            Card,
            Cards,
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { params } = props;
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
