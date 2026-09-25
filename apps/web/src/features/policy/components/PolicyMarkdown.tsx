import type { ComponentProps } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/shared/lib/cn';

function isExternal(href: string | undefined): boolean {
  return Boolean(href && /^https?:\/\//.test(href));
}

const components: Components = {
  h1: ({ node: _node, children, ...props }) => (
    <h2 className="mb-4 text-2xl font-semibold tracking-tight" {...props}>
      {children}
    </h2>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h3 className="mt-10 mb-3 border-b pb-2 text-lg font-semibold" {...props}>
      {children}
    </h3>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h4 className="mt-6 mb-2 text-base font-semibold" {...props}>
      {children}
    </h4>
  ),
  p: ({ node: _node, ...props }) => <p className="my-3 leading-7 text-foreground/90" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="my-3 list-disc space-y-1.5 pl-6" {...props} />,
  ol: ({ node: _node, ...props }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-6" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="leading-7" {...props} />,
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-4 border-l-2 border-primary bg-subtle px-4 py-2 text-muted-foreground"
      {...props}
    />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]', className)}
      {...props}
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg border bg-subtle p-4 text-sm [&_code]:bg-transparent [&_code]:p-0"
      {...props}
    />
  ),
  a: ({ node: _node, href, children, ...props }) =>
    isExternal(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline-offset-2 hover:underline dark:text-foreground"
        {...props}
      >
        {children}
      </a>
    ) : (
      // Repository-relative links do not resolve in the web app; show them as references.
      <span className="font-medium">{children}</span>
    ),
  table: ({ node: _node, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-subtle" {...props} />,
  th: ({ node: _node, ...props }) => (
    <th
      className="border-b px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-b px-3 py-2 align-top [tr:last-child_&]:border-b-0" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="my-8" {...props} />,
};

export function PolicyMarkdown({
  markdown,
  className,
}: { markdown: string } & ComponentProps<'div'>) {
  return (
    <div className={cn('text-sm sm:text-[15px]', className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
