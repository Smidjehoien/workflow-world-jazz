import type { Metadata } from 'next';
import { CTA } from './components/cta';
import { Features } from './components/features';
import { Frameworks } from './components/frameworks';
import { Hero } from './components/hero';
import { Implementation } from './components/implementation';
import { Intro } from './components/intro/intro';
import { Observability } from './components/observability';
import { Templates } from './components/templates';
import { UseCases } from './components/use-cases';

export const metadata: Metadata = {
  title: 'The TypeScript Framework for Durable Execution | Workflow SDK',
  description:
    'The Workflow SDK brings durability and reliability to async JavaScript. Mark functions with directives to make them automatically persistent, resumable, and observable.',
};

const Home = () => (
  <>
    <Hero />
    <div className="grid divide-y border-y sm:border-x">
      <Intro />
      <Implementation />
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
        <Observability />
        <Frameworks />
      </div>
      <Features />
      <UseCases />
      <Templates />
      <CTA />
    </div>
  </>
);

export default Home;
