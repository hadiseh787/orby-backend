export function contractEvents(result:any,contract:string) {
  const events:any[]=[];
  for(const receipt of result?.receipts_outcome||[]){
    if(receipt.outcome?.executor_id!==contract)continue;
    for(const log of receipt.outcome.logs||[])if(log.startsWith('EVENT_JSON:')){
      try{const value=JSON.parse(log.slice(11));for(const item of value.data||[])events.push({event:value.event,...item,receiptId:receipt.id});}catch{}
    }
  }return events;
}
export function transactionResult(result:any,proposal:any) {
  if(result?.final_execution_status!=='FINAL')return {state:'UNKNOWN',failure:'The transaction is not final yet.'};
  if(!result.status||!Object.hasOwn(result.status,'SuccessValue'))return {state:'FAILED',failure:JSON.stringify(result.status?.Failure||'The transaction failed.')};
  if(proposal.methodName==='withdraw'){
    const id=proposal.signerId+':'+proposal.args.request_id;
    const callback=contractEvents(result,proposal.receiverId).find(e=>e.event==='withdrawal_completed'&&e.id===id);
    if(!callback)return {state:'UNKNOWN',failure:'Waiting for the transfer callback.'};
    if(callback.value?.success!==true)return {state:'FAILED',failure:'The transfer failed. The contract restored the available balance.'};
  }
  return {state:'CONFIRMED',failure:undefined};
}
