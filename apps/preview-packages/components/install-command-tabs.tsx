import { compileMdx } from 'nextra/compile';
import { Tabs } from 'nextra/components';
import { MDXRemote } from 'nextra/mdx-remote';

export default async function InstallCommandTabs() {
  const baseUrl = process.env.VERCEL_URL;

  // Package names with tarball extensions
  const corePackage = `https://${baseUrl}/vercel-workflow-core.tgz`;
  const nextPackage = `https://${baseUrl}/vercel-workflow-next.tgz`;

  const mdxSource = `
  <Tabs items={['pnpm', 'npm', 'bun', 'yarn']}>
  <Tabs.Tab>

  \`\`\`bash copy
  pnpm i ${nextPackage} ${corePackage}
  \`\`\`

  </Tabs.Tab>
  <Tabs.Tab>

  \`\`\`bash copy
  npm i ${nextPackage} ${corePackage}
  \`\`\`

  </Tabs.Tab>
    <Tabs.Tab>

  \`\`\`bash copy
  bun add ${nextPackage} ${corePackage}
  \`\`\`

  </Tabs.Tab>
  <Tabs.Tab>

  \`\`\`bash copy
  yarn add ${nextPackage} ${corePackage}
  \`\`\`

  </Tabs.Tab>
  </Tabs>
  `;

  const compiled = await compileMdx(mdxSource);

  return <MDXRemote compiledSource={compiled} components={{ Tabs }} />;
}
