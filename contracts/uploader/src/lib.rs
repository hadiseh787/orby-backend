use base64::Engine;
#[link(wasm_import_module="env")]
extern "C"{
 fn input(register:u64);fn register_len(register:u64)->u64;fn read_register(register:u64,ptr:u64);
 fn predecessor_account_id(register:u64);fn current_account_id(register:u64);
 fn storage_write(kl:u64,kp:u64,vl:u64,vp:u64,register:u64)->u64;
 fn storage_read(kl:u64,kp:u64,register:u64)->u64;fn storage_remove(kl:u64,kp:u64,register:u64)->u64;
 fn sha256(len:u64,ptr:u64,register:u64);fn panic_utf8(len:u64,ptr:u64)->!;
 fn promise_batch_create(len:u64,ptr:u64)->u64;
 fn promise_batch_action_deploy_contract(index:u64,len:u64,ptr:u64);
}
fn fail()->!{unsafe{panic_utf8(20,b"INVALID_OWNER_OR_DATA".as_ptr()as u64)}}
unsafe fn reg(id:u64)->Vec<u8>{let n=register_len(id);if n>2_000_000{fail()}let mut v=vec![0;n as usize];read_register(id,v.as_mut_ptr()as u64);v}
unsafe fn authorize(){predecessor_account_id(1);current_account_id(2);if reg(1)!=reg(2){fail()}}
unsafe fn payload()->serde_json::Value{input(0);serde_json::from_slice(&reg(0)).unwrap_or_else(|_|fail())}
#[no_mangle]
pub unsafe extern "C" fn stage(){authorize();let p=payload();let index=p["index"].as_u64().unwrap_or_else(||fail());if index>128{fail()}let data=base64::engine::general_purpose::STANDARD.decode(p["data"].as_str().unwrap_or_else(||fail())).unwrap_or_else(|_|fail());if data.len()>16384{fail()}let key=format!("upload:{index}");storage_write(key.len()as u64,key.as_ptr()as u64,data.len()as u64,data.as_ptr()as u64,3);}
#[no_mangle]
pub unsafe extern "C" fn commit(){authorize();let p=payload();let count=p["count"].as_u64().unwrap_or_else(||fail());if count==0||count>128{fail()}let mut code=Vec::new();for index in 0..count{let key=format!("upload:{index}");if storage_read(key.len()as u64,key.as_ptr()as u64,3)==0{fail()}code.extend_from_slice(&reg(3));}sha256(code.len()as u64,code.as_ptr()as u64,4);let actual=reg(4).iter().map(|b|format!("{b:02x}")).collect::<String>();if Some(actual.as_str())!=p["sha256"].as_str(){fail()}for index in 0..count{let key=format!("upload:{index}");storage_remove(key.len()as u64,key.as_ptr()as u64,3);}current_account_id(2);let account=reg(2);let promise=promise_batch_create(account.len()as u64,account.as_ptr()as u64);promise_batch_action_deploy_contract(promise,code.len()as u64,code.as_ptr()as u64);}
