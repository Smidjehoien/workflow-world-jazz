'use client';

import { track } from '@vercel/analytics';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const useCases = [
  {
    id: 'ai-agents',
    label: 'AI Agents',
    code: `export async function aiAgentWorkflow(query: string) {
  "use workflow";
  
  // Step 1: Generate initial response
  const response = await generateResponse(query);
  
  // Step 2: Research and validate
  const facts = await researchFacts(response);
  
  // Step 3: Refine with fact-checking
  const refined = await refineWithFacts(response, facts);
  
  return { response: refined, sources: facts };
}`,
  },
  {
    id: 'retrying',
    label: 'Retrying',
    code: `export async function imageProcessingWorkflow(imageUrl: string) {
  "use workflow";
  
  // Step 1: Download and validate image
  const image = await downloadImage(imageUrl);
  
  // Step 2: Generate thumbnails
  const thumbnails = await generateThumbnails(image);
  
  // Step 3: Upload to storage
  await uploadToStorage(thumbnails);
  
  return { status: 'processed', thumbnails };
}`,
  },
  {
    id: 'sleep',
    label: 'Sleep',
    code: `export async function dataIngestionWorkflow(source: string) {
  "use workflow";
  
  // Step 1: Extract data from source
  const rawData = await extractData(source);
  
  // Step 2: Transform and clean
  const cleaned = await transformData(rawData);
  
  // Step 3: Load into warehouse
  await loadToWarehouse(cleaned);
  
  return { recordsProcessed: cleaned.length };
}`,
  },
  {
    id: 'webhook',
    label: 'Webhook',
    code: `export async function userOnboardingWorkflow(userId: string) {
  "use workflow";
  
  // Step 1: Send welcome email
  await sendWelcomeEmail(userId);
  
  // Step 2: Wait 24 hours
  await sleep("24h");
  
  // Step 3: Send onboarding tips
  await sendOnboardingTips(userId);
  
  // Step 4: Wait 3 days
  await sleep("3d");
  
  // Step 5: Request feedback
  await requestFeedback(userId);
  
  return { status: 'onboarded' };
}`,
  },
  {
    id: 'streaming',
    label: 'Streaming',
    code: `export async function emailCampaignWorkflow(campaignId: string) {
  "use workflow";
  
  // Step 1: Get subscriber list
  const subscribers = await getSubscribers(campaignId);
  
  // Step 2: Personalize content for each
  const emails = await personalizeEmails(subscribers);
  
  // Step 3: Send in batches
  await sendInBatches(emails, { batchSize: 100 });
  
  // Step 4: Track and analyze results
  const analytics = await trackCampaignMetrics(campaignId);
  
  return { sent: emails.length, analytics };
}`,
  },
  {
    id: 'promise.race',
    label: 'Promise.race',
    code: `export async function emailCampaignWorkflow(campaignId: string) {
  "use workflow";
  
  // Step 1: Get subscriber list
  const subscribers = await getSubscribers(campaignId);
  
  // Step 2: Personalize content for each
  const emails = await personalizeEmails(subscribers);
  
  // Step 3: Send in batches
  await sendInBatches(emails, { batchSize: 100 });
  
  // Step 4: Track and analyze results
  const analytics = await trackCampaignMetrics(campaignId);
  
  return { sent: emails.length, analytics };
}`,
  },
  {
    id: 'promise.all',
    label: 'Promise.all',
    code: `export async function emailCampaignWorkflow(campaignId: string) {
  "use workflow";
  
  // Step 1: Get subscriber list
  const subscribers = await getSubscribers(campaignId);
  
  // Step 2: Personalize content for each
  const emails = await personalizeEmails(subscribers);
  
  // Step 3: Send in batches
  await sendInBatches(emails, { batchSize: 100 });
  
  // Step 4: Track and analyze results
  const analytics = await trackCampaignMetrics(campaignId);
  
  return { sent: emails.length, analytics };
}`,
  },
];

export const UseCases = () => {
  const [selectedCase, setSelectedCase] = useState(useCases[0].id);
  const currentCase =
    useCases.find((uc) => uc.id === selectedCase) || useCases[0];

  const handleCaseChange = (value: string) => {
    setSelectedCase(value);
    track('Use case changed', { case: value });
  };

  return (
    <div className="grid sm:grid-cols-3 sm:divide-x p-8 sm:p-0 gap-12 sm:gap-0">
      <div className="text-balance flex flex-col gap-2 sm:p-12">
        <h2 className="font-semibold text-xl tracking-tight sm:text-2xl md:text-3xl">
          Patterns for
          <Select value={selectedCase} onValueChange={handleCaseChange}>
            <SelectTrigger className="font-semibold bg-background text-xl tracking-tight sm:text-2xl md:text-3xl mt-1 data-[size=default]:h-auto py-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {useCases.map((useCase) => (
                <SelectItem key={useCase.id} value={useCase.id}>
                  {useCase.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </h2>
        <p className="text-balance text-lg text-muted-foreground">
          Build reliable, long-running processes with automatic retries, state
          persistence, and observability built in.
        </p>
      </div>
      <div className="col-span-2 sm:p-12">
        <DynamicCodeBlock
          code={currentCase.code}
          lang="ts"
          codeblock={{
            className: 'shadow-none bg-background dark:bg-sidebar rounded-md',
          }}
        />
      </div>
    </div>
  );
};
