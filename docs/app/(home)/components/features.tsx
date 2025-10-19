const data = [
  {
    title: 'Reliability, Minus the Plumbing',
    description:
      'Start with plain async code. No queues to wire, no schedulers to tune, no YAML. Best‑in‑class DX that compiles reliability into your app with zero config.',
  },
  {
    title: 'See Every Step, Instantly',
    description:
      'Inspect every run end‑to‑end. Pause, replay, and time‑travel through steps with traces, logs, and metrics automatically captured — no extra services or setup.',
  },
  {
    title: 'Run Anywhere, No Lock‑In',
    description:
      'The same code runs locally on your laptop, in Docker, on Vercel or any other cloud. Open source and portable by design.',
  },
];

export const Features = () => (
  <div className="p-8 sm:p-12 grid md:grid-cols-3 gap-8">
    {data.map((item) => (
      <div key={item.title}>
        <h3 className="mt-4 mb-2 font-semibold text-lg tracking-tight">
          {item.title}
        </h3>
        <p className="text-muted-foreground">{item.description}</p>
      </div>
    ))}
  </div>
);
