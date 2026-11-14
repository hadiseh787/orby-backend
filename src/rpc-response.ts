// NEAR nodes expose both typed JSON-RPC errors and legacy query result.error.
export function nearRpcError(data:any,method:string,params:any):string|null{
 if(data?.error)return data.error.cause?.name||data.error.name||'RPC_UNAVAILABLE';
 const legacy=data?.result?.error;if(!legacy)return null;
 const message=typeof legacy==='string'?legacy:'';
 if(method==='query'&&params?.request_type==='view_access_key'&&/^access key .+ does not exist while viewing$/i.test(message))return 'UNKNOWN_ACCESS_KEY';
 if(method==='query'&&/^account .+ does not exist while viewing$/i.test(message))return 'UNKNOWN_ACCOUNT';
 if(method==='query'&&params?.request_type==='call_function')return 'CONTRACT_EXECUTION_ERROR';
 return 'RPC_QUERY_ERROR';
}
