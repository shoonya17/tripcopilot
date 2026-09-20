import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { processIngestionFunction, tripLifecycleSweep, briefingSweep, preTripBriefingSweep, retentionSweep, outboxPublisher } from '@/inngest/functions';
export const { GET, POST, PUT } = serve({ client: inngest, functions: [processIngestionFunction, tripLifecycleSweep, briefingSweep, preTripBriefingSweep, retentionSweep, outboxPublisher] });
