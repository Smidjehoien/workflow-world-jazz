'use client';

import { motion } from 'motion/react';

const rows = [
  { label: 'workflow()', color: 'bg-blue-500', start: 0, duration: 100 },
  { label: 'process()', color: 'bg-green-500', start: 0, duration: 20 },
  { label: 'parse()', color: 'bg-green-500', start: 20, duration: 25 },
  { label: 'transform()', color: 'bg-green-500', start: 45, duration: 20 },
  { label: 'enrich()', color: 'bg-green-500', start: 65, duration: 15 },
  { label: 'validate()', color: 'bg-green-500', start: 80, duration: 20 },
];

export const Observability = () => (
  <div className="grid gap-12 p-8 sm:p-12">
    <div className="text-balance flex flex-col gap-2">
      <h2 className="font-medium text-xl tracking-tight sm:text-2xl text-muted-foreground">
        <span className="text-foreground">Observability</span>. Inspect every
        run end‑to‑end. Pause, replay, and time‑travel through steps with
        traces, logs, and metrics automatically.
      </h2>
    </div>
    <div>
      <div className="space-y-3 w-full">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex flex-col gap-px overflow-hidden"
            style={{
              marginLeft: `${row.start}%`,
              width: `${row.duration}%`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-foreground">
                {row.label}
              </span>
              {index === 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {row.duration}ms
                </span>
              )}
            </div>
            <div className="relative h-2.5 w-full">
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                whileInView={{ width: 'auto', opacity: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.15,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`h-full ${row.color} rounded-xs hover:opacity-80`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
