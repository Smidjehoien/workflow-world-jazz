'use client';

import type { WorldConfig } from '@/lib/config-world';

interface ConnectionStatusProps {
  config: WorldConfig;
}

export function ConnectionStatus({ config }: ConnectionStatusProps) {
  const backend = config.backend || 'embedded';

  const getConnectionInfo = () => {
    if (backend === 'vercel') {
      const parts: string[] = [];
      if (config.env) parts.push(config.env);
      if (config.project) parts.push(`project: ${config.project}`);
      if (config.team) parts.push(`team: ${config.team}`);

      return `Vercel${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
    }

    // Embedded backend
    const parts: string[] = [];
    if (config.dataDir) {
      parts.push(config.dataDir);
    }
    if (config.port) parts.push(`port ${config.port}`);

    return `Embedded${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
  };

  return (
    <div className="text-sm text-muted-foreground mb-6">
      Connected to: <span className="font-medium">{getConnectionInfo()}</span>
    </div>
  );
}
