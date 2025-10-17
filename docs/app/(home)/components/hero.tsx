'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export const Hero = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText('npm install workflow');
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to copy text to clipboard';

      toast.error(message);
    }
  };

  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <section className="mt-[var(--fd-nav-height)] space-y-6 px-4 pt-24 pb-16 text-center">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Badge variant="secondary">
          <div className="size-2 rounded-full bg-muted-foreground" />
          <p className="tracking-tight">Workflow SDK is in beta</p>
        </Badge>
        <h1 className="flex flex-col items-center justify-center text-center font-semibold text-4xl! leading-tighter tracking-tight lg:font-semibold lg:leading-[1.1] lg:text-5xl! xl:text-6xl! xl:tracking-tighter">
          <p>The TypeScript Framework for "Long Running" Execution</p>
        </h1>
        <p className="text-balance text-muted-foreground text-xl">
          The Workflow Development Kit brings durability and reliability to
          async JavaScript. Mark functions with directives to make them
          automatically persistent, resumable, and observable.
        </p>
      </div>
      <div className="inline-flex w-fit mx-auto items-center gap-3">
        <Button asChild size="lg" className="h-[46px]">
          <Link href="/docs/introduction">Get Started</Link>
        </Button>
        <div className="relative bg-background border rounded-md overflow-hidden py-3 pl-4 pr-12 mx-auto inline-flex w-fit">
          <Input
            value="npm install workflow"
            disabled
            className="bg-transparent p-0 text-foreground h-auto border-none font-mono disabled:opacity-100 outline-none shadow-none"
          />
          <Button
            onClick={handleCopy}
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2"
          >
            <Icon className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </section>
  );
};
