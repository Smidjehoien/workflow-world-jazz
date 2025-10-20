'use client';

import NumberFlow from '@number-flow/react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { CheckIcon, Loader2Icon, XIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const code = `async function userSignupWorkflow(message: string) {
  "use workflow";

  const { textPrompt, imagePrompt } = await generatePrompts(message);
  const message = await generateText(textPrompt);
  const image = await generateImage(imagePrompt);

  return { text, image };
}`;

const Loading = (
  <Loader2Icon className="size-[13px] text-muted-foreground animate-spin" />
);
const Success = (
  <div className="bg-green-500 size-[13px] rounded-full flex items-center justify-center">
    <CheckIcon className="size-[10px] text-[var(--background)]" />
  </div>
);
const Error = (
  <div className="bg-red-500 size-[13px] rounded-full flex items-center justify-center">
    <XIcon className="size-[10px] text-[var(--background)]" />
  </div>
);

type LineState = 'idle' | 'loading' | 'success' | 'error';

const TOKENS_PER_STEP = 1000;

export const WorkflowExample = () => {
  const [lineStates, setLineStates] = useState<LineState[]>([
    'idle',
    'idle',
    'idle',
  ]);
  const [isRetry, setIsRetry] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const animate = async () => {
      if (isRetry) {
        // On retry with workflow: only the failed step re-runs
        // Steps 1 and 2 are already successful, so skip directly to step 3
        setLineStates((prev) => {
          const next = [...prev];
          next[2] = 'loading';
          return next;
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (cancelled) return;

        setLineStates((prev) => {
          const next = [...prev];
          next[2] = 'success';
          return next;
        });

        // Only add tokens for the retried step
        setTotalTokens((prev) => prev + TOKENS_PER_STEP);
      } else {
        // Initial run: reset to idle
        setLineStates(['idle', 'idle', 'idle']);

        // First 2 lines: loading for 1s, then success
        for (let i = 0; i < 2; i++) {
          if (cancelled) return;

          setLineStates((prev) => {
            const next = [...prev];
            next[i] = 'loading';
            return next;
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (cancelled) return;

          setLineStates((prev) => {
            const next = [...prev];
            next[i] = 'success';
            return next;
          });

          // Add tokens for each successful step
          setTotalTokens((prev) => prev + TOKENS_PER_STEP);
        }

        // Last line: loading for 1s, then error
        if (cancelled) return;

        setLineStates((prev) => {
          const next = [...prev];
          next[2] = 'loading';
          return next;
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (cancelled) return;

        setLineStates((prev) => {
          const next = [...prev];
          next[2] = 'error';
          return next;
        });

        // Add tokens even for failed step
        setTotalTokens((prev) => prev + TOKENS_PER_STEP);
      }
    };

    animate();

    return () => {
      cancelled = true;
    };
  }, [isRetry]);

  const renderIndicator = (state: LineState) => {
    if (state === 'loading') return Loading;
    if (state === 'success') return Success;
    if (state === 'error') return Error;
    return null;
  };

  const handleRetry = () => {
    setIsRetry(true);
  };

  return (
    <div className="relative isolate max-w-3xl mx-auto">
      <div className="absolute z-10 flex flex-col left-[18px] top-[74px] gap-[5.5px] pointer-events-none select-none">
        {lineStates.map(renderIndicator)}
      </div>
      <DynamicCodeBlock
        code={code}
        lang="ts"
        codeblock={{
          className:
            'shadow-none bg-background dark:bg-sidebar rounded-md with-checks with-line-numbers',
        }}
      />
      <div className="flex justify-between items-center mt-4">
        <div>
          <Button
            onClick={handleRetry}
            disabled={lineStates[2] !== 'error'}
            variant="outline"
            size="lg"
          >
            <RefreshCwIcon className="size-[16px]" /> Retry
          </Button>
        </div>
        <div className="text-base text-foreground">
          <NumberFlow value={totalTokens} suffix=" tokens" />
        </div>
      </div>
    </div>
  );
};
