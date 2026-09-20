import { createIngestion, processIngestion } from './ingestion';
import { inngest } from '@/inngest/client';
export async function dispatchIngestion(ingestionId:string,tenantId:string){
  if(process.env.INNGEST_EVENT_KEY){ await inngest.send({name:'tripcopilot/ingestion.received',data:{ingestionId,tenantId}}); return {queued:true}; }
  await processIngestion(ingestionId,tenantId); return {queued:false};
}
