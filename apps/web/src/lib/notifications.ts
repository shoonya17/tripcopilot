import { db } from './db';
import { env } from './env';
export async function emitNotification(input:{tenantId:string;tripId:string;category:string;channel:string;deliveryKey:string;briefingGenerationId?:string;payload:unknown}){
  const existing=await db.notificationDelivery.findUnique({where:{deliveryKey:input.deliveryKey}}); if(existing) return existing;
  const row=await db.notificationDelivery.create({data:{tenantId:input.tenantId,tripId:input.tripId,briefingGenerationId:input.briefingGenerationId,category:input.category,channel:input.channel,deliveryKey:input.deliveryKey,status:'PENDING',attemptedAt:new Date()}});
  try{
    if(env.NOTIFICATION_WEBHOOK_URL){
      const res=await fetch(env.NOTIFICATION_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tripId:input.tripId,category:input.category,channel:input.channel,payload:input.payload})});
      if(!res.ok) throw new Error(`WEBHOOK_${res.status}`);
    }
    return db.notificationDelivery.update({where:{notificationDeliveryId:row.notificationDeliveryId},data:{status:'DELIVERED',deliveredAt:new Date()}});
  }catch(e){
    return db.notificationDelivery.update({where:{notificationDeliveryId:row.notificationDeliveryId},data:{status:'FAILED',errorCode:'DELIVERY_FAILED',errorMessage:e instanceof Error?e.message:'unknown'}});
  }
}
