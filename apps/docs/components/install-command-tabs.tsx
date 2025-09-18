import { Tabs, Tab } from '@/components/ui/tabs';
import { CodeBlock } from './ui/code-block';

export default function InstallCommandTabs() {
  const baseUrl = process.env.VERCEL_URL;

  // Package names with tarball extensions
  const corePackage = `https://${baseUrl}/vercel-workflow-core.tgz`;
  const nextPackage = `https://${baseUrl}/vercel-workflow-next.tgz`;

  return (
    <Tabs items={['pnpm', 'npm', 'yarn']}>
      <Tab value="pnpm">
        <CodeBlock>
          pnpm i {nextPackage} \{'\n'} {corePackage}
        </CodeBlock>
      </Tab>
      <Tab value="npm">
        <CodeBlock>
          npm i {nextPackage} \{'\n'} {corePackage}
        </CodeBlock>
      </Tab>
      <Tab value="yarn">
        <CodeBlock>
          yarn add {nextPackage} \{'\n'} {corePackage}
        </CodeBlock>
      </Tab>
    </Tabs>
  );
}
