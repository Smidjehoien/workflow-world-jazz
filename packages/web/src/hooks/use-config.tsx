'use client';

import { createContext, useContext } from 'react';
import type { WorldConfig } from '@/lib/world';

const ConfigContext = createContext<WorldConfig | null>(null);

export function ConfigProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: WorldConfig;
}) {
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): WorldConfig {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return config;
}
