'use client';

import { motion } from 'motion/react';

const rows = [
  {
    label: 'workflow()',
    bgColor: 'bg-blue-500/20',
    strokeColor: 'blue-500',
    start: 0,
    duration: 100,
  },
  {
    label: 'process()',
    bgColor: 'bg-green-500/20',
    strokeColor: 'green-500',
    start: 0,
    duration: 20,
  },
  {
    label: 'parse()',
    bgColor: 'bg-green-500/20',
    strokeColor: 'green-500',
    start: 20,
    duration: 25,
  },
  {
    label: 'transform()',
    bgColor: 'bg-green-500/20',
    strokeColor: 'green-500',
    start: 45,
    duration: 20,
  },
  {
    label: 'enrich()',
    bgColor: 'bg-green-500/20',
    strokeColor: 'green-500',
    start: 65,
    duration: 15,
  },
  {
    label: 'validate()',
    bgColor: 'bg-green-500/20',
    strokeColor: 'green-500',
    start: 80,
    duration: 20,
  },
];

export const Observability = () => (
  <div className="grid grid-rows-[auto_1fr] gap-12 p-8 sm:p-12">
    <h2 className="font-medium text-xl tracking-tight sm:text-2xl text-muted-foreground">
      <span className="text-foreground">Observability</span>. Inspect every run
      end‑to‑end. Pause, replay, and time‑travel through steps with traces,
      logs, and metrics automatically.
    </h2>
    <div className="">
      <div className="space-y-3 w-full">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex flex-col overflow-hidden"
            style={{
              marginLeft: `${row.start}%`,
              width: `${row.duration}%`,
            }}
          >
            <div className="relative h-6 w-full">
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                whileInView={{ width: 'auto', opacity: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{
                  duration: 0.55,
                  delay: index * 0.15,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`h-full ${row.bgColor} rounded-sm border border-${row.strokeColor} overflow-hidden`}
              >
                <div className="flex justify-between items-center px-2 py-[4px]">
                  <span className="text-[11px] font-mono font-medium text-foreground">
                    {row.label}
                  </span>
                  {index === 0 && (
                    <span className={`text-[11px] text-${row.strokeColor}`}>
                      {row.duration}ms
                    </span>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
