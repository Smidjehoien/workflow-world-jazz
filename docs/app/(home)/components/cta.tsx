import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const CTA = () => (
  <section className="px-12 py-10 flex items-center justify-between gap-4">
    <h2 className="font-semibold text-xl tracking-tight sm:text-2xl md:text-3xl lg:text-4xl">
      Create your first workflow today.
    </h2>
    <Button asChild className="w-fit" size="lg">
      <Link href="/docs/getting-started">
        Get started <ArrowRight className="size-4" />
      </Link>
    </Button>
  </section>
);
