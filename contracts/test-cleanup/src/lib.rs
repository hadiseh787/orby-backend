// Temporary load-fixture cleanup only. Never deploy over the marketplace contract.
use base64::Engine;
#[link(wasm_import_module="env")]
extern "C" {fn input(r:u64);fn register_len(r:u64)->u64;fn read_register(r:u64,p:u64);fn predecessor_account_id(r:u64);fn current_account_id(r:u64);fn storage_remove(n:u64,p:u64,r:u64)->u64;fn panic_utf8(n:u64,p:u64)->!;}
unsafe fn fail()->!{panic_utf8(13,b"FIXTURE_ONLY!".as_ptr() as u64)}
unsafe fn read(r:u64)->Vec<u8>{let n=register_len(r);if n>200_000{fail()}let mut b=vec![0;n as usize];read_register(r,b.as_mut_ptr() as u64);b}
#[no_mangle]
pub unsafe extern "C" fn clear_fixture(){predecessor_account_id(1);current_account_id(2);let account=read(2);if read(1)!=account||!account.starts_with(b"load-")||!account.ends_with(b".testnet"){fail()}input(0);let p:serde_json::Value=serde_json::from_slice(&read(0)).unwrap_or_else(|_|fail());let keys=p["keys"].as_array().unwrap_or_else(||fail());if keys.len()>100{fail()}for value in keys{let key=base64::engine::general_purpose::STANDARD.decode(value.as_str().unwrap_or_else(||fail())).unwrap_or_else(|_|fail());if key.len()>4096{fail()}storage_remove(key.len() as u64,key.as_ptr() as u64,3);}}
