use orby_financial::{muldiv, Q};
use near_sdk::json_types::{U128, U64};
use near_sdk::{assert_one_yocto, env, near, AccountId, Gas, NearToken, Promise, PromiseOrValue};
use std::collections::BTreeMap;
use near_sdk::store::IterableMap;
#[cfg(test)]
mod behavior;
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Agent {
    pub owner: AccountId,
    pub manifest_hash: String,
    pub min_price: U128,
    pub active: bool,
    pub version: u64,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Policy {
    pub executor: AccountId,
    pub max_spend: U128,
    pub max_bond: U128,
    pub allowed: Vec<String>,
    pub expires_at: U64,
    pub paused: bool,
    pub version: u64,
}
#[near(serializers=[borsh,json])]
#[derive(Clone, Default)]
pub struct Balance {
    pub free: U128,
    pub bond: U128,
    pub reserved_bond: U128,
    pub withdrawal_pending: U128,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Bid {
    pub job_id: String,
    pub agent_id: String,
    pub price: U128,
    pub eta_ms: U64,
    pub expires_at: U64,
    pub manifest_version: u64,
    pub policy_version: u64,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Job {
    pub client: AccountId,
    pub agent_id: Option<String>,
    pub creator: Option<AccountId>,
    pub terms_hash: String,
    pub usd_micro: U128,
    pub deadline_ms: U64,
    pub manual: bool,
    pub state: String,
    pub version: u64,
    pub escrow: U128,
    pub bond: U128,
    pub n0: U128,
    pub funding_price: U128,
    pub child_cap: U128,
    pub child_spent: U128,
    pub children: Vec<String>,
    pub parent: Option<String>,
    pub start_deadline: U64,
    pub review_deadline: U64,
    pub dispute_deadline: U64,
    pub revision: u8,
    pub delivery_hash: String,
    pub checks_pass: bool,
    pub no_delivery: bool,
    pub settlement: Option<Settlement>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Settlement {
    pub award: U128,
    pub fee: U128,
    pub refund: U128,
    pub creator_credit: U128,
    pub penalty: U128,
    pub shortfall: bool,
    pub fallback_used: bool,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Operation {
    pub payload_hash: String,
    pub outcome: String,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Withdrawal {
    pub owner: AccountId,
    pub amount: U128,
    pub done: bool,
}
#[near(contract_state)]
pub struct Market {
    admin: AccountId,
    evaluator: AccountId,
    updater: AccountId,
    agents: IterableMap<String, Agent>,
    policies: IterableMap<String, Policy>,
    jobs: IterableMap<String, Job>,
    bids: IterableMap<String, Bid>,
    balances: IterableMap<AccountId, Balance>,
    operations: IterableMap<String, Operation>,
    withdrawals: IterableMap<String, Withdrawal>,
    price: U128,
    price_time: U64,
    price_mode: String,
    quarantined: bool,
    paused: bool,
    accelerated: bool,
    native_jobs: IterableMap<String, U128>,
    native_agents: IterableMap<String, U128>,
    user_liabilities: U128,
    storage_budget: U128,
    live_balances: u64,
    open_escrows: u64,
    #[borsh(skip)]
    storage_start: Option<u64>,
    #[borsh(skip)]
    protect_exit_reserve: bool,
}
#[near(serializers=[borsh])]
pub struct LegacyMarketV2 {
    admin: AccountId,
    evaluator: AccountId,
    updater: AccountId,
    agents: BTreeMap<String, Agent>,
    policies: BTreeMap<String, Policy>,
    jobs: BTreeMap<String, Job>,
    bids: BTreeMap<String, Bid>,
    balances: BTreeMap<AccountId, Balance>,
    operations: BTreeMap<String, Operation>,
    withdrawals: BTreeMap<String, Withdrawal>,
    price: U128,
    price_time: U64,
    price_mode: String,
    quarantined: bool,
    paused: bool,
    accelerated: bool,
    native_jobs: BTreeMap<String, U128>,
    native_agents: BTreeMap<String, U128>,
}
// V1 layout is retained verbatim so upgrades preserve all existing escrows.
#[near(serializers=[borsh])]
pub struct LegacyMarket {
    admin: AccountId, evaluator: AccountId, updater: AccountId,
    agents: BTreeMap<String, Agent>, policies: BTreeMap<String, Policy>,
    jobs: BTreeMap<String, Job>, bids: BTreeMap<String, Bid>,
    balances: BTreeMap<AccountId, Balance>, operations: BTreeMap<String, Operation>,
    withdrawals: BTreeMap<String, Withdrawal>, price: U128, price_time: U64,
    price_mode: String, quarantined: bool, paused: bool, accelerated: bool,
}
impl Default for Market {
    fn default() -> Self {
        env::panic_str("Initialize contract first")
    }
}
#[near]
impl Market {
    #[init]
    pub fn new(
        admin: AccountId,
        evaluator: AccountId,
        updater: AccountId,
        accelerated: bool,
    ) -> Self {
        let mut market=Self {
            admin,
            evaluator,
            updater,
            agents: IterableMap::new(b"v3:agents".as_slice()),
            policies: IterableMap::new(b"v3:policies".as_slice()),
            jobs: IterableMap::new(b"v3:jobs".as_slice()),
            bids: IterableMap::new(b"v3:bids".as_slice()),
            balances: IterableMap::new(b"v3:balances".as_slice()),
            operations: IterableMap::new(b"v3:operations".as_slice()),
            withdrawals: IterableMap::new(b"v3:withdrawals".as_slice()),
            price: U128(5_000_000),
            price_time: U64(env::block_timestamp_ms()),
            price_mode: "FIXTURE".into(),
            quarantined: false,
            paused: false,
            accelerated,
            native_jobs: IterableMap::new(b"v3:native_jobs".as_slice()),
            native_agents: IterableMap::new(b"v3:native_agents".as_slice()),
            user_liabilities: U128(0),
            storage_budget: U128(0),
            live_balances: 0,
            open_escrows: 0,
            storage_start: Some(env::storage_usage()),
            protect_exit_reserve: false,
        };
        market.storage_budget=U128(market.available_sponsor());
        market.finish_storage();
        market
    }
    #[private]
    #[init(ignore_state)]
    pub fn migrate_v1() -> Self {
        let old: LegacyMarket = env::state_read().expect("V1_STATE_REQUIRED");
        Self::from_legacy(LegacyMarketV2 {
            admin:old.admin,evaluator:old.evaluator,updater:old.updater,agents:old.agents,policies:old.policies,jobs:old.jobs,bids:old.bids,balances:old.balances,operations:old.operations,withdrawals:old.withdrawals,price:old.price,price_time:old.price_time,price_mode:old.price_mode,quarantined:old.quarantined,paused:old.paused,accelerated:old.accelerated,native_jobs:BTreeMap::new(),native_agents:BTreeMap::new(),
        })
    }
    #[private]
    #[init(ignore_state)]
    pub fn migrate_v2() -> Self {
        let old:LegacyMarketV2=env::state_read().expect("V2_STATE_REQUIRED");
        Self::from_legacy(old)
    }
    #[payable]
    pub fn sponsor_storage(&mut self) {
        self.begin_storage();
        let amount=env::attached_deposit().as_yoctonear();assert!(amount>0,"INVALID_AMOUNT");
        self.storage_budget=U128(self.storage_budget.0.checked_add(amount).expect("OVERFLOW"));self.finish_storage();
    }
    pub fn get_storage_status(&self)->near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"version":3,"user_liabilities":self.user_liabilities,"storage_budget":self.storage_budget,"protected_exit_reserve":U128(self.required_exit_reserve()),"live_balances":self.live_balances,"open_escrows":self.open_escrows,"counts":{"agents":self.agents.len(),"policies":self.policies.len(),"jobs":self.jobs.len(),"bids":self.bids.len(),"balances":self.balances.len(),"operations":self.operations.len(),"withdrawals":self.withdrawals.len(),"native_jobs":self.native_jobs.len(),"native_agents":self.native_agents.len()},"storage_bytes":env::storage_usage(),"available_sponsor":U128(self.available_sponsor()),"callback_gas_tgas":50,"history_policy":"Permanent bounded idempotency tombstones; growth is sponsor-funded. No replay-enabling pruning."})
    }
    pub fn get_withdrawal(&self,withdrawal_id:String)->Option<Withdrawal>{self.withdrawals.get(&withdrawal_id).cloned()}
    pub fn get_near_budget(&self, job_id: String) -> Option<U128> { self.native_jobs.get(&job_id).cloned() }
    pub fn get_near_price(&self, agent_id: String) -> Option<U128> { self.native_agents.get(&agent_id).cloned() }
    pub fn get_version(&self) -> u32 { 3 }
    pub fn register_near_agent(&mut self, request_id: String, agent_id: String, manifest_hash: String, min_price: U128) {
        let args = near_sdk::serde_json::json!([agent_id,manifest_hash,min_price]);
        if self.once_named("register_near_agent",&request_id,&args) { return; }
        self.new_allowed();
        assert!(!self.agents.contains_key(&agent_id), "AGENT_EXISTS");
        assert!(agent_id.len()>=3 && agent_id.len()<=48 && agent_id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b==b'-') && manifest_hash.len()==64 && min_price.0>0 && min_price.0<=100*Q,"INVALID_MANIFEST");
        // A native-only agent has no legacy USD minimum. Its NEAR minimum lives in native_agents.
        self.agents.insert(agent_id.clone(), Agent { owner: env::predecessor_account_id(), manifest_hash, min_price:U128(0), active:true, version:1 });
        self.native_agents.insert(agent_id.clone(),min_price);
        self.emit("agent_registered",&agent_id,args);
        self.done(request_id,"registered in NEAR");
    }
    pub fn set_agent_near_price(&mut self, request_id: String, agent_id: String, min_price: U128) {
        self.new_allowed();
        let args=near_sdk::serde_json::json!([agent_id,min_price]);
        if self.once_named("set_agent_near_price",&request_id,&args) { return; }
        let agent=self.agent(&agent_id);
        assert_eq!(agent.owner,env::predecessor_account_id(),"FORBIDDEN");
        assert!(min_price.0>0 && min_price.0<=100*Q,"INVALID_AMOUNT");
        self.native_agents.insert(agent_id,min_price);
        self.done(request_id,"NEAR price updated");
    }
    pub fn open_near_job(&mut self, request_id: String, job_id: String, terms_hash: String, budget: U128, deadline_ms: U64, manual: bool) {
        let args=near_sdk::serde_json::json!([job_id,terms_hash,budget,deadline_ms,manual]);
        if self.once_named("open_near_job",&request_id,&args) { return; }
        self.new_allowed();
        Self::valid_id(&job_id,80);
        assert!(!self.jobs.contains_key(&job_id),"JOB_EXISTS");
        assert!(terms_hash.len()==64 && budget.0>0 && budget.0<=100*Q && deadline_ms.0>self.now(),"INVALID_TERMS");
        self.native_jobs.insert(job_id.clone(),budget);
        self.put_job(job_id.clone(), Job {
            client:env::predecessor_account_id(),agent_id:None,creator:None,terms_hash,
            usd_micro:U128(0),deadline_ms,manual,state:"OPEN".into(),version:1,
            escrow:U128(0),bond:U128(0),n0:U128(0),funding_price:U128(0),child_cap:U128(0),child_spent:U128(0),
            children:vec![],parent:None,start_deadline:U64(0),review_deadline:U64(0),dispute_deadline:U64(0),
            revision:0,delivery_hash:String::new(),checks_pass:false,no_delivery:false,settlement:None,
        });
        self.emit("job_opened",&job_id,args);self.done(request_id,"opened in NEAR");
    }
    pub fn get_config(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"network":"testnet","price_mode":self.price_mode,"accelerated":self.accelerated,"paused":self.paused,"admin":self.admin,"evaluator":self.evaluator,"updater":self.updater,"fee_bps":1000,"buffer_bps":1000,"bond_bps":2000})
    }
    pub fn get_agent(&self, agent_id: String) -> Option<Agent> {
        self.agents.get(&agent_id).cloned()
    }
    pub fn get_policy(&self, agent_id: String) -> Option<Policy> {
        self.policies.get(&agent_id).cloned()
    }
    pub fn get_bid(&self, bid_id: String) -> Option<Bid> { self.bids.get(&bid_id).cloned() }
    pub fn get_job(&self, job_id: String) -> Option<Job> {
        self.jobs.get(&job_id).cloned()
    }
    pub fn get_balance(&self, account_id: AccountId) -> Balance {
        self.balances.get(&account_id).cloned().unwrap_or_default()
    }
    pub fn get_operation(&self, account_id: AccountId, request_id: String) -> Option<Operation> {
        self.operations
            .get(&format!("{}:{}", account_id, request_id))
            .cloned()
    }
    pub fn get_price(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"price_micro":self.price,"publish_time":self.price_time,"mode":self.price_mode,"quarantined":self.quarantined})
    }
    pub fn list_jobs(&self, from_index: u32, limit: u32) -> Vec<(String, Job)> {
        self.jobs
            .iter()
            .skip(from_index as usize)
            .take(limit.min(50) as usize)
            .map(|(id, j)| (id.clone(), j.clone()))
            .collect()
    }
    pub fn register_agent(
        &mut self,
        request_id: String,
        agent_id: String,
        manifest_hash: String,
        min_price: U128,
    ) {
        let args = near_sdk::serde_json::json!([agent_id, manifest_hash, min_price]);
        if self.once_named("register_agent",&request_id,&args) {
            return;
        }
        self.new_allowed();
        assert!(!self.agents.contains_key(&agent_id), "AGENT_EXISTS");
        assert!(
            agent_id.len() >= 3
                && agent_id.len() <= 48
                && manifest_hash.len() == 64
                && min_price.0 > 0,
            "INVALID_MANIFEST"
        );
        self.agents.insert(
            agent_id.clone(),
            Agent {
                owner: env::predecessor_account_id(),
                manifest_hash,
                min_price,
                active: true,
                version: 1,
            },
        );
        self.emit("agent_registered", &agent_id, args);
        self.done(request_id, "registered");
    }
    pub fn update_agent(&mut self, request_id: String, agent_id: String, manifest_hash: String) {
        self.new_allowed();
        let args = near_sdk::serde_json::json!([agent_id, manifest_hash]);
        if self.once_named("update_agent",&request_id,&args) {
            return;
        }
        let mut a = self.agent(&agent_id);
        assert_eq!(a.owner, env::predecessor_account_id(), "FORBIDDEN");
        assert_eq!(manifest_hash.len(), 64, "INVALID_HASH");
        a.manifest_hash = manifest_hash;
        a.version += 1;
        self.agents.insert(agent_id, a);
        self.done(request_id, "updated");
    }
    pub fn set_execution_policy(
        &mut self,
        request_id: String,
        agent_id: String,
        executor: AccountId,
        max_spend: U128,
        max_bond: U128,
        allowed: Vec<String>,
        expires_at: U64,
        paused: bool,
    ) {
        self.new_allowed();
        let args = near_sdk::serde_json::json!([
            agent_id, executor, max_spend, max_bond, allowed, expires_at, paused
        ]);
        if self.once_named("set_execution_policy",&request_id,&args) {
            return;
        }
        assert_eq!(
            self.agent(&agent_id).owner,
            env::predecessor_account_id(),
            "FORBIDDEN"
        );
        assert!(
            allowed.len() <= 10 && expires_at.0 > self.now(),
            "INVALID_POLICY"
        );
        for id in &allowed {Self::valid_id(id,48);}
        let version = self.policies.get(&agent_id).map_or(1, |p| p.version + 1);
        self.policies.insert(
            agent_id.clone(),
            Policy {
                executor,
                max_spend,
                max_bond,
                allowed,
                expires_at,
                paused,
                version,
            },
        );
        self.emit("policy_set", &agent_id, args);
        self.done(request_id, "policy updated");
    }
    #[payable]
    pub fn deposit_funds(&mut self, request_id: String) {
        self.deposit(request_id, false)
    }
    #[payable]
    pub fn deposit_bond(&mut self, request_id: String) {
        self.deposit(request_id, true)
    }
    pub fn release_unused_bond(&mut self,request_id:String,amount:U128){
        let args=near_sdk::serde_json::json!([amount]);if self.once_named("release_unused_bond",&request_id,&args){return;}
        assert!(amount.0>0,"INVALID_AMOUNT");let owner=env::predecessor_account_id();let mut b=self.get_balance(owner.clone());self.protect_exit_reserve=amount.0!=b.bond.0;
        b.bond=U128(b.bond.0.checked_sub(amount.0).expect("INSUFFICIENT_AVAILABLE_BOND"));
        b.free=U128(b.free.0.checked_add(amount.0).expect("OVERFLOW"));self.put_balance(owner,b);
        self.done(request_id,"unused bond released");
    }
    pub fn open_job(
        &mut self,
        request_id: String,
        job_id: String,
        terms_hash: String,
        usd_micro: U128,
        deadline_ms: U64,
        manual: bool,
    ) {
        let args =
            near_sdk::serde_json::json!([job_id, terms_hash, usd_micro, deadline_ms, manual]);
        if self.once_named("open_job",&request_id,&args) {
            return;
        }
        self.new_allowed();
        Self::valid_id(&job_id,80);
        assert!(!self.jobs.contains_key(&job_id), "JOB_EXISTS");
        assert!(
            terms_hash.len() == 64
                && usd_micro.0 >= 1_000_000
                && usd_micro.0 <= 100_000_000
                && deadline_ms.0 > self.now(),
            "INVALID_TERMS"
        );
        let j = Job {
            client: env::predecessor_account_id(),
            agent_id: None,
            creator: None,
            terms_hash,
            usd_micro,
            deadline_ms,
            manual,
            state: "OPEN".into(),
            version: 1,
            escrow: U128(0),
            bond: U128(0),
            n0: U128(0),
            funding_price: U128(0),
            child_cap: U128(0),
            child_spent: U128(0),
            children: vec![],
            parent: None,
            start_deadline: U64(0),
            review_deadline: U64(0),
            dispute_deadline: U64(0),
            revision: 0,
            delivery_hash: String::new(),
            checks_pass: false,
            no_delivery: false,
            settlement: None,
        };
        self.put_job(job_id.clone(), j);
        self.emit("job_opened", &job_id, args);
        self.done(request_id, "opened");
    }
    pub fn cancel_job(&mut self, request_id: String, job_id: String) {
        self.protect_exit_reserve=true;
        let args = near_sdk::serde_json::json!([job_id]);
        if self.once_named("cancel_job",&request_id,&args) {
            return;
        }
        let mut j = self.job(&job_id);
        assert_eq!(j.client, env::predecessor_account_id(), "FORBIDDEN");
        assert_eq!(j.state, "OPEN", "INVALID_STATE");
        j.state = "CANCELLED".into();
        j.version += 1;
        self.put_job(job_id, j);
        self.done(request_id, "cancelled");
    }
    pub fn record_bid(
        &mut self,
        request_id: String,
        bid_id: String,
        job_id: String,
        agent_id: String,
        price: U128,
        eta_ms: U64,
        expires_at: U64,
    ) {
        let args =
            near_sdk::serde_json::json!([bid_id, job_id, agent_id, price, eta_ms, expires_at]);
        if self.once_named("record_bid",&request_id,&args) {
            return;
        }
        self.new_allowed();
        let (a, p) = self.executor(&agent_id);
        let j = self.job(&job_id);
        assert_eq!(j.state, "OPEN", "INVALID_STATE");
        let (minimum,budget)=if let Some(budget)=self.native_jobs.get(&job_id) {
            let minimum=self.native_agents.get(&agent_id).map(|v|v.0).unwrap_or_else(||muldiv(a.min_price.0,Q,self.price.0,true));
            (minimum,budget.0)
        } else { assert!(a.min_price.0>0,"LEGACY_JOB_REQUIRES_LEGACY_AGENT"); (a.min_price.0,j.usd_micro.0) };
        assert!(
            price.0 >= minimum && price.0 <= budget && expires_at.0 > self.now() && j.deadline_ms.0>self.now(),
            "INVALID_BID"
        );
        Self::valid_id(&bid_id,80);Self::valid_id(&agent_id,48);
        assert!(!self.bids.contains_key(&bid_id), "BID_EXISTS");
        self.bids.insert(
            bid_id.clone(),
            Bid {
                job_id: job_id.clone(),
                agent_id,
                price,
                eta_ms,
                expires_at,
                manifest_version: a.version,
                policy_version: p.version,
            },
        );
        self.emit("bid_recorded", &job_id, args);
        self.done(request_id, "bid recorded");
    }
    #[payable]
    pub fn award_and_fund(
        &mut self,
        request_id: String,
        job_id: String,
        bid_id: String,
        expected_version: u64,
        preview_expires_at: U64,
    ) {
        let deposit = env::attached_deposit().as_yoctonear();
        let args = near_sdk::serde_json::json!([
            job_id,
            bid_id,
            expected_version,
            preview_expires_at,
            U128(deposit)
        ]);
        if self.once_named_payable("award_and_fund",&request_id,&args) {
            return;
        }
        self.new_allowed();
        if !self.native_jobs.contains_key(&job_id) { self.valid_price(); }
        assert!(
            self.now() <= preview_expires_at.0 && preview_expires_at.0 <= self.now() + 300000,
            "PREVIEW_STALE"
        );
        let mut j = self.job(&job_id);
        assert_eq!(j.client, env::predecessor_account_id(), "FORBIDDEN");
        assert_eq!(j.state, "OPEN", "INVALID_STATE");
        assert_eq!(j.version, expected_version, "PREVIEW_STALE");
        assert!(j.deadline_ms.0>self.now(),"JOB_EXPIRED");
        let b = self.bids.get(&bid_id).expect("BID_NOT_FOUND").clone();
        let a = self.agent(&b.agent_id);
        let p = self.policy(&b.agent_id);
        assert!(
            b.job_id == job_id
                && b.expires_at.0 > self.now()
                && b.manifest_version == a.version
                && b.policy_version == p.version
                && a.active
                && !p.paused
                && p.expires_at.0 > self.now(),
            "BID_EXPIRED"
        );
        let n0 = if self.native_jobs.contains_key(&job_id) { b.price.0 } else { muldiv(b.price.0, Q, self.price.0, true) };
        let escrow = muldiv(n0, 11000, 10000, true);
        assert_eq!(deposit, escrow, "ESCROW_AMOUNT_MISMATCH");
        let bond = muldiv(n0, 2000, 10000, true);
        self.reserve_bond(&a.owner, bond, p.max_bond.0);
        if !self.native_jobs.contains_key(&job_id) { j.usd_micro = b.price; }
        j.n0 = U128(n0);
        j.escrow = U128(escrow);
        j.bond = U128(bond);
        j.funding_price = self.price;
        j.child_cap = U128(muldiv(n0, 8000, 10000, false).min(p.max_spend.0));
        j.creator = Some(a.owner);
        j.agent_id = Some(b.agent_id);
        j.start_deadline = U64(self.now() + if self.accelerated { 300000 } else { 600000 });
        j.state = "FUNDED".into();
        j.version += 1;
        self.put_job(job_id.clone(), j);
        self.emit(
            "job_funded",
            &job_id,
            near_sdk::serde_json::json!({"escrow":U128(escrow),"unit":"testNEAR"}),
        );
        self.done(request_id, "funded");
    }
    pub fn start_job(&mut self, request_id: String, job_id: String) {
        let args = near_sdk::serde_json::json!([job_id]);
        if self.once_named("start_job",&request_id,&args) {
            return;
        }
        let mut j = self.job(&job_id);
        self.executor(j.agent_id.as_ref().expect("NO_AGENT"));
        assert_eq!(j.state, "FUNDED", "INVALID_STATE");
        assert!(self.now() <= j.start_deadline.0, "START_DEADLINE");
        j.state = "RUNNING".into();
        j.version += 1;
        self.put_job(job_id, j);
        self.done(request_id, "started");
    }
    pub fn fund_child(
        &mut self,
        request_id: String,
        job_id: String,
        child_id: String,
        agent_id: String,
        amount: U128,
        terms_hash: String,
        deadline_ms: U64,
    ) {
        let args = near_sdk::serde_json::json!([
            job_id,
            child_id,
            agent_id,
            amount,
            terms_hash,
            deadline_ms
        ]);
        if self.once_named("fund_child",&request_id,&args) {
            return;
        }
        self.new_allowed();
        let mut root = self.job(&job_id);
        let (_, p) = self.executor(root.agent_id.as_ref().expect("NO_AGENT"));
        assert!(
            root.parent.is_none() && root.children.len() < 3 && root.state == "RUNNING",
            "POLICY_LIMIT"
        );
        assert!(p.allowed.contains(&agent_id), "POLICY_LIMIT");
        let a = self.agent(&agent_id);
        assert!(
            a.active && Some(a.owner.clone()) != root.creator && a.owner != root.client,
            "SELF_HIRE"
        );
        let child_policy = self.policy(&agent_id);
        assert!(
            !child_policy.paused && child_policy.expires_at.0 > self.now(),
            "POLICY_LIMIT"
        );
        assert!(
            amount.0 > 0
                && root.child_spent.0.checked_add(amount.0).expect("OVERFLOW") <= root.child_cap.0
                && root.child_spent.0 + amount.0 <= p.max_spend.0,
            "POLICY_LIMIT"
        );
        let gap = if self.accelerated { 15000 } else { 900000 };
        assert!(
            deadline_ms.0 > self.now() && deadline_ms.0 + gap <= root.deadline_ms.0,
            "INVALID_DEADLINE"
        );
        Self::valid_id(&child_id,80);assert_eq!(terms_hash.len(),64,"INVALID_HASH");
        assert!(!self.jobs.contains_key(&child_id), "JOB_EXISTS");
        let owner = root.creator.clone().unwrap();
        self.debit(&owner, amount.0);
        let bond = muldiv(amount.0, 2000, 10000, true);
        self.reserve_bond(&a.owner, bond, child_policy.max_bond.0);
        let child = Job {
            client: owner,
            agent_id: Some(agent_id),
            creator: Some(a.owner),
            terms_hash,
            usd_micro: U128(0),
            deadline_ms,
            manual: false,
            state: "FUNDED".into(),
            version: 1,
            escrow: amount,
            bond: U128(bond),
            n0: amount,
            funding_price: root.funding_price,
            child_cap: U128(0),
            child_spent: U128(0),
            children: vec![],
            parent: Some(job_id.clone()),
            start_deadline: U64(self.now() + if self.accelerated { 300000 } else { 600000 }),
            review_deadline: U64(0),
            dispute_deadline: U64(0),
            revision: 0,
            delivery_hash: String::new(),
            checks_pass: false,
            no_delivery: false,
            settlement: None,
        };
        root.child_spent = U128(root.child_spent.0 + amount.0);
        root.children.push(child_id.clone());
        root.version += 1;
        self.put_job(job_id.clone(), root);
        self.put_job(child_id, child);
        self.emit("child_funded", &job_id, args);
        self.done(request_id, "child funded");
    }
    pub fn submit_delivery(
        &mut self,
        request_id: String,
        job_id: String,
        delivery_hash: String,
        revision: u8,
    ) {
        let args = near_sdk::serde_json::json!([job_id, delivery_hash, revision]);
        if self.once_named("submit_delivery",&request_id,&args) {
            return;
        }
        let mut j = self.job(&job_id);
        self.executor(j.agent_id.as_ref().expect("NO_AGENT"));
        assert!(
            j.state == "RUNNING" || j.state == "REVISION_REQUIRED",
            "INVALID_STATE"
        );
        assert!(
            self.now() <= j.deadline_ms.0 && delivery_hash.len() == 64 && revision == j.revision,
            "INVALID_DELIVERY"
        );
        j.delivery_hash = delivery_hash;
        j.state = "DELIVERED".into();
        j.version += 1;
        self.put_job(job_id.clone(), j);
        self.emit("delivery_recorded", &job_id, args);
        self.done(request_id, "delivered");
    }
    pub fn record_checks(
        &mut self,
        request_id: String,
        job_id: String,
        delivery_hash: String,
        passed: bool,
        report_hash: String,
    ) {
        let args = near_sdk::serde_json::json!([job_id, delivery_hash, passed, report_hash]);
        if self.once_named("record_checks",&request_id,&args) {
            return;
        }
        assert_eq!(env::predecessor_account_id(), self.evaluator, "FORBIDDEN");
        let mut j = self.job(&job_id);
        assert!(
            j.state == "DELIVERED" && j.delivery_hash == delivery_hash && report_hash.len() == 64,
            "INVALID_STATE"
        );
        j.checks_pass = passed;
        if passed {
            j.state = "REVIEW_OPEN".into();
            j.review_deadline = U64(self.now() + if self.accelerated { 90000 } else { 86400000 });
        } else if j.revision == 0 {
            j.revision = 1;
            j.state = "REVISION_REQUIRED".into();
            j.deadline_ms = U64(j.deadline_ms.0.min(self.now() + 43200000));
        } else {
            j.state = "DISPUTED".into();
            j.dispute_deadline =
                U64(self.now() + if self.accelerated { 180000 } else { 172800000 });
        }
        j.version += 1;
        self.put_job(job_id.clone(), j);
        self.emit("checks_recorded", &job_id, args);
        self.done(request_id, "checks recorded");
    }
    pub fn approve_delivery(&mut self,request_id:String,job_id:String,revision:u8,delivery_hash:String){
        let args=near_sdk::serde_json::json!(["approve_delivery",job_id,revision,delivery_hash]);if self.once_named("approve_delivery",&request_id,&args){return;}
        let j=self.job(&job_id);assert_eq!(j.revision,revision,"DELIVERY_CHANGED");assert_eq!(j.delivery_hash,delivery_hash,"DELIVERY_CHANGED");
        self.approve_internal(&job_id);self.done(request_id,"version-bound delivery approved");
    }
    pub fn request_revision(&mut self, request_id:String,job_id:String,revision:u8,delivery_hash:String,feedback_hash:String) {
        let args=near_sdk::serde_json::json!([job_id,revision,delivery_hash,feedback_hash]);
        if self.once_named("request_revision",&request_id,&args){return;}
        let mut j=self.job(&job_id);
        assert_eq!(j.client,env::predecessor_account_id(),"FORBIDDEN");
        assert_eq!(j.state,"REVIEW_OPEN","INVALID_STATE");
        assert!(j.revision==0 && revision==j.revision && j.delivery_hash==delivery_hash,"DELIVERY_CHANGED");
        assert!(self.now()<j.deadline_ms.0 && feedback_hash.len()==64,"INVALID_REVISION");
        j.revision=1;j.state="REVISION_REQUIRED".into();j.version+=1;
        self.put_job(job_id.clone(),j);self.emit("revision_requested",&job_id,args);self.done(request_id,"revision requested");
    }
    pub fn approve_job(&mut self, request_id: String, job_id: String) {
        let args = near_sdk::serde_json::json!(["approve_job",job_id]);
        if self.once_named("approve_job",&request_id,&args) { return; }
        assert!(!self.native_jobs.contains_key(&job_id),"VERSION_BOUND_APPROVAL_REQUIRED");
        self.approve_internal(&job_id);self.done(request_id,"legacy delivery approved");
    }
    pub fn open_dispute(&mut self, request_id: String, job_id: String, reason_hash: String) {
        let args = near_sdk::serde_json::json!([job_id, reason_hash]);
        if self.once_named("open_dispute",&request_id,&args) {
            return;
        }
        let mut j = self.job(&job_id);
        self.party(&j);
        assert!(
            [
                "RUNNING",
                "DELIVERED",
                "REVIEW_OPEN",
                "REVISION_REQUIRED",
                "FUNDED"
            ]
            .contains(&j.state.as_str())
                && reason_hash.len() == 64,
            "INVALID_STATE"
        );
        j.state = "DISPUTED".into();
        j.dispute_deadline = U64(self.now() + if self.accelerated { 180000 } else { 172800000 });
        j.version += 1;
        self.put_job(job_id.clone(), j);
        self.emit("dispute_opened", &job_id, args);
        self.done(request_id, "disputed");
    }
    pub fn resolve_dispute(
        &mut self,
        request_id: String,
        job_id: String,
        award_bps: u16,
        penalty_bps: u16,
        reason_hash: String,
    ) {
        let args = near_sdk::serde_json::json!([job_id, award_bps, penalty_bps, reason_hash]);
        if self.once_named("resolve_dispute",&request_id,&args) {
            return;
        }
        assert_eq!(env::predecessor_account_id(), self.admin, "FORBIDDEN");
        assert!(
            self.job(&job_id).state == "DISPUTED" && reason_hash.len() == 64,
            "INVALID_STATE"
        );
        self.settle(&job_id, award_bps, penalty_bps, false);
        self.done(request_id, "resolved");
    }
    pub fn claim_due_transition(&mut self, request_id: String, job_id: String) {
        let args = near_sdk::serde_json::json!([job_id]);
        if self.once_named("claim_due_transition",&request_id,&args) {
            return;
        }
        let mut j = self.job(&job_id);
        let now = self.now();
        if j.state == "REVIEW_OPEN" && !j.manual && j.checks_pass && now >= j.review_deadline.0 {
            self.settle(&job_id, 10000, 0, false);
        } else if j.state == "DISPUTED" && now >= j.dispute_deadline.0 {
            self.settle(
                &job_id,
                if j.no_delivery { 0 } else { 5000 },
                if j.no_delivery { 2500 } else { 0 },
                true,
            );
        } else if (j.state == "FUNDED" && now > j.start_deadline.0)
            || (["RUNNING", "REVISION_REQUIRED"].contains(&j.state.as_str())
                && now > j.deadline_ms.0)
        {
            assert_eq!(env::predecessor_account_id(), j.client, "FORBIDDEN");
            j.no_delivery = true;
            j.state = "DISPUTED".into();
            j.dispute_deadline = U64(now + if self.accelerated { 60000 } else { 43200000 });
            j.version += 1;
            self.put_job(job_id, j);
        } else if j.state == "REVIEW_OPEN" && j.manual && now > j.review_deadline.0 {
            assert_eq!(Some(env::predecessor_account_id()), j.creator, "FORBIDDEN");
            j.state = "DISPUTED".into();
            j.dispute_deadline = U64(now + if self.accelerated { 180000 } else { 172800000 });
            j.version += 1;
            self.put_job(job_id, j);
        } else {
            env::panic_str("DEADLINE_NOT_REACHED")
        }
        self.done(request_id, "due transition");
    }
    pub fn settle_with_funding_price(&mut self, request_id: String, job_id: String) {
        let args = near_sdk::serde_json::json!([job_id]);
        if self.once_named("settle_with_funding_price",&request_id,&args) {
            return;
        }
        let j = self.job(&job_id);
        self.party(&j);
        assert!(
            self.now() > self.price_time.0 + 1800000
                && j.state == "REVIEW_OPEN"
                && !j.manual
                && j.checks_pass
                && self.now() >= j.review_deadline.0,
            "DEADLINE_NOT_REACHED"
        );
        self.settle(&job_id, 10000, 0, true);
        self.done(request_id, "funding price fallback");
    }
    #[payable]
    pub fn withdraw(&mut self, request_id: String, amount: U128) -> PromiseOrValue<bool> {
        assert_one_yocto();
        let args = near_sdk::serde_json::json!([amount]);
        if self.once_named("withdraw",&request_id,&args) {
            return PromiseOrValue::Value(true);
        }
        let owner = env::predecessor_account_id();
        let existing=self.get_balance(owner.clone());
        self.protect_exit_reserve=amount.0!=existing.free.0||existing.bond.0!=0||existing.reserved_bond.0!=0||existing.withdrawal_pending.0!=0;
        self.debit(&owner, amount.0);
        assert!(amount.0 > 0, "INVALID_AMOUNT");
        let mut b = self.get_balance(owner.clone());
        b.withdrawal_pending = U128(b.withdrawal_pending.0 + amount.0);
        self.put_balance(owner.clone(), b);
        let id = format!("{}:{}", owner, request_id);
        self.withdrawals.insert(
            id.clone(),
            Withdrawal {
                owner: owner.clone(),
                amount,
                done: false,
            },
        );
        self.done(request_id, "withdrawal reserved");
        self.emit(
            "withdrawal_started",
            &id,
            near_sdk::serde_json::json!({"amount":amount,"unit":"testNEAR"}),
        );
        PromiseOrValue::Promise(
            Promise::new(owner)
                .transfer(NearToken::from_yoctonear(amount.0))
                .then(
                    Promise::new(env::current_account_id()).function_call(
                        "on_withdraw_result",
                        near_sdk::serde_json::to_vec(
                            &near_sdk::serde_json::json!({"withdrawal_id":id}),
                        )
                        .unwrap(),
                        NearToken::from_yoctonear(0),
                        Gas::from_tgas(50),
                    ),
                ),
        )
    }
    #[private]
    pub fn on_withdraw_result(&mut self, withdrawal_id: String) {
        self.begin_storage();
        assert_eq!(env::promise_results_count(), 1, "INVALID_CALLBACK");
        let mut w = self
            .withdrawals
            .get(&withdrawal_id)
            .expect("UNKNOWN_WITHDRAWAL")
            .clone();
        if w.done {
            return;
        }
        let mut b = self.get_balance(w.owner.clone());
        b.withdrawal_pending = U128(
            b.withdrawal_pending
                .0
                .checked_sub(w.amount.0)
                .expect("RESERVATION_MISMATCH"),
        );
        let success = env::promise_result_checked(0, 0).is_ok();
        if !success {
            b.free = U128(b.free.0 + w.amount.0)
        }
        self.put_balance(w.owner.clone(), b);
        w.done = true;
        self.withdrawals.insert(withdrawal_id.clone(), w);
        self.emit(
            "withdrawal_completed",
            &withdrawal_id,
            near_sdk::serde_json::json!({"success":success}),
        );
        self.finish_storage();
    }
    pub fn update_reference_price(
        &mut self,
        request_id: String,
        price_micro: U128,
        publish_time: U64,
        mode: String,
        accept_jump: bool,
        reason_hash: String,
    ) {
        let args = near_sdk::serde_json::json!([
            price_micro,
            publish_time,
            mode,
            accept_jump,
            reason_hash
        ]);
        if self.once_named("update_reference_price",&request_id,&args) {
            return;
        }
        let caller = env::predecessor_account_id();
        assert!(caller == self.updater || caller == self.admin, "FORBIDDEN");
        assert!(
            price_micro.0 > 0
                && publish_time.0 <= self.now()
                && publish_time.0 > self.price_time.0
                && ["FIXTURE", "LIVE_REFERENCE"].contains(&mode.as_str()),
            "INVALID_PRICE"
        );
        assert!(mode == self.price_mode, "PRICE_MODE_IMMUTABLE");
        let jump = self.price.0.abs_diff(price_micro.0) > self.price.0 / 10;
        if jump && !accept_jump {
            self.quarantined = true;
        } else {
            if jump {
                assert!(caller == self.admin && reason_hash.len() == 64, "FORBIDDEN");
            }
            self.price = price_micro;
            self.price_time = publish_time;
            self.quarantined = false;
        }
        self.emit("price_updated", "price", args);
        self.done(request_id, "price updated");
    }
    pub fn pause_new(&mut self, request_id: String, paused: bool) {
        let args = near_sdk::serde_json::json!([paused]);
        if self.once_named("pause_new",&request_id,&args) {
            return;
        }
        assert_eq!(env::predecessor_account_id(), self.admin, "FORBIDDEN");
        self.paused = paused;
        self.done(request_id, "pause updated");
    }
    pub fn set_agent_active(&mut self, request_id: String, agent_id: String, active: bool) {
        let args = near_sdk::serde_json::json!([agent_id, active]);
        if self.once_named("set_agent_active",&request_id,&args) {
            return;
        }
        assert_eq!(env::predecessor_account_id(), self.admin, "FORBIDDEN");
        let mut a = self.agent(&agent_id);
        a.active = active;
        a.version += 1;
        self.agents.insert(agent_id, a);
        self.done(request_id, "availability updated");
    }
}
impl Market {

    fn from_legacy(old:LegacyMarketV2)->Self {
        let mut m=Self::new(old.admin,old.evaluator,old.updater,old.accelerated);
        m.price=old.price;m.price_time=old.price_time;m.price_mode=old.price_mode;m.quarantined=old.quarantined;m.paused=old.paused;
        for(k,v) in old.agents {m.agents.insert(k,v);}for(k,v) in old.policies {m.policies.insert(k,v);}
        for(k,v) in old.balances {m.put_balance(k,v);}for(k,v) in old.jobs {m.put_job(k,v);}
        for(k,v) in old.bids {m.bids.insert(k,v);}for(k,v) in old.operations {m.operations.insert(k,v);}
        for(k,v) in old.withdrawals {m.withdrawals.insert(k,v);}for(k,v) in old.native_jobs {m.native_jobs.insert(k,v);}for(k,v) in old.native_agents {m.native_agents.insert(k,v);}
        // Migrations may grow storage; only unencumbered contract funds back it.
        m.storage_budget=U128(m.available_sponsor());m.protect_exit_reserve=true;m.finish_storage();m
    }
    fn balance_liability(b:&Balance)->u128 {b.free.0.checked_add(b.bond.0).and_then(|x|x.checked_add(b.reserved_bond.0)).and_then(|x|x.checked_add(b.withdrawal_pending.0)).expect("OVERFLOW")}
    fn escrow_liability(j:&Job)->u128 {if ["SETTLED","REFUNDED","CANCELLED"].contains(&j.state.as_str()){0}else{j.escrow.0}}
    fn put_balance(&mut self,id:AccountId,b:Balance){let old=self.balances.get(&id).map_or(0,Self::balance_liability);let next=Self::balance_liability(&b);if old==0&&next>0{self.live_balances+=1;}else if old>0&&next==0{self.live_balances-=1;}self.user_liabilities=U128(self.user_liabilities.0.checked_sub(old).and_then(|x|x.checked_add(next)).expect("LIABILITY_INVARIANT"));self.balances.insert(id,b);}
    fn put_job(&mut self,id:String,j:Job){let old=self.jobs.get(&id).map_or(0,Self::escrow_liability);let next=Self::escrow_liability(&j);if old==0&&next>0{self.open_escrows+=1;}else if old>0&&next==0{self.open_escrows-=1;}self.user_liabilities=U128(self.user_liabilities.0.checked_sub(old).and_then(|x|x.checked_add(next)).expect("LIABILITY_INVARIANT"));self.jobs.insert(id,j);}
    fn flush_maps(&mut self){self.agents.flush();self.policies.flush();self.jobs.flush();self.bids.flush();self.balances.flush();self.operations.flush();self.withdrawals.flush();self.native_jobs.flush();self.native_agents.flush();}
    fn projected_storage(&self)->u64 {
        let old=env::storage_read(b"STATE").map_or(0,|x|x.len() as u64);let new=borsh::to_vec(self).expect("SERIALIZE_STATE").len() as u64;
        env::storage_usage().checked_add(new).and_then(|x|x.checked_sub(old)).expect("STORAGE_INVARIANT")
    }
    fn available_sponsor(&self)->u128 {let cost=u128::from(self.projected_storage())*env::storage_byte_cost().as_yoctonear();env::account_balance().as_yoctonear().saturating_sub(self.user_liabilities.0).saturating_sub(cost).saturating_sub(Q/20)}
    fn required_exit_reserve(&self)->u128 {u128::from(self.live_balances)*Q/10+u128::from(self.open_escrows)*3*Q/10}
    fn begin_storage(&mut self){if self.storage_start.is_none(){self.storage_start=Some(self.projected_storage());}}
    fn finish_storage(&mut self){
        self.begin_storage();let baseline=self.storage_start.unwrap();self.flush_maps();let projected=self.projected_storage();
        let growth=u128::from(projected.saturating_sub(baseline))*env::storage_byte_cost().as_yoctonear();
        self.storage_budget=U128(self.storage_budget.0.checked_sub(growth).expect("SPONSOR_STORAGE_BUDGET_EXHAUSTED"));
        let cost=u128::from(projected)*env::storage_byte_cost().as_yoctonear();
        assert!(env::account_balance().as_yoctonear()>=self.user_liabilities.0.checked_add(cost).and_then(|x|x.checked_add(Q/20)).expect("OVERFLOW"),"USER_BACKING_RESERVED");
        self.storage_budget=U128(self.storage_budget.0.min(self.available_sponsor()));
        if self.protect_exit_reserve{assert!(self.storage_budget.0>=self.required_exit_reserve(),"EXIT_STORAGE_RESERVE_PROTECTED");}
        self.storage_start=Some(projected);
        self.protect_exit_reserve=false;
    }
    fn valid_id(id:&str,max:usize){assert!(!id.is_empty()&&id.len()<=max&&id.bytes().all(|b|b.is_ascii_alphanumeric()||b"-_:./".contains(&b)),"INVALID_IDENTIFIER");}
    fn validate_args(&self,args:&near_sdk::serde_json::Value){
        fn bounded(v:&near_sdk::serde_json::Value){match v {near_sdk::serde_json::Value::String(s)=>assert!(s.len()<=128,"INPUT_TOO_LONG"),near_sdk::serde_json::Value::Array(a)=>{assert!(a.len()<=16,"INPUT_TOO_LONG");for x in a{bounded(x)}},near_sdk::serde_json::Value::Object(o)=>{assert!(o.len()<=16,"INPUT_TOO_LONG");for x in o.values(){bounded(x)}},_=>{}}}
        bounded(args);assert!(near_sdk::serde_json::to_vec(args).unwrap().len()<=4096,"INPUT_TOO_LONG");
    }
    fn approve_internal(&mut self,id:&str){let j=self.job(id);assert_eq!(j.client,env::predecessor_account_id(),"FORBIDDEN");assert!(j.state=="REVIEW_OPEN"&&j.checks_pass,"INVALID_STATE");self.settle(id,10000,0,false);}

    fn now(&self) -> u64 {
        env::block_timestamp_ms()
    }
    fn new_allowed(&mut self) {
        assert!(!self.paused,"SYSTEM_PAUSED");self.protect_exit_reserve=true;assert!(self.storage_budget.0>self.required_exit_reserve()&&self.available_sponsor()>self.required_exit_reserve(),"STORAGE_RESERVE_LOW");
    }
    fn valid_price(&self) {
        assert!(!self.quarantined, "PRICE_QUARANTINED");
        assert!(
            self.price_mode == "FIXTURE" || self.now() <= self.price_time.0 + 300000,
            "PRICE_STALE"
        );
    }
    fn agent(&self, id: &str) -> Agent {
        self.agents.get(id).expect("AGENT_NOT_FOUND").clone()
    }
    fn policy(&self, id: &str) -> Policy {
        self.policies.get(id).expect("POLICY_NOT_FOUND").clone()
    }
    fn job(&self, id: &str) -> Job {
        self.jobs.get(id).expect("JOB_NOT_FOUND").clone()
    }
    fn party(&self, j: &Job) {
        let a = env::predecessor_account_id();
        assert!(a == j.client || Some(a) == j.creator, "FORBIDDEN");
    }
    fn executor(&self, id: &str) -> (Agent, Policy) {
        let a = self.agent(id);
        let p = self.policy(id);
        let c = env::predecessor_account_id();
        assert!(
            a.active
                && (c == a.owner || c == p.executor)
                && !p.paused
                && p.expires_at.0 > self.now(),
            "POLICY_LIMIT"
        );
        (a, p)
    }
    fn debit(&mut self, owner: &AccountId, value: u128) {
        let mut b = self.get_balance(owner.clone());
        b.free = U128(b.free.0.checked_sub(value).expect("INSUFFICIENT_BALANCE"));
        self.put_balance(owner.clone(), b);
    }
    fn credit(&mut self, owner: &AccountId, value: u128) {
        let mut b = self.get_balance(owner.clone());
        b.free = U128(b.free.0.checked_add(value).expect("OVERFLOW"));
        self.put_balance(owner.clone(), b);
    }
    fn reserve_bond(&mut self, owner: &AccountId, value: u128, ceiling: u128) {
        let mut b = self.get_balance(owner.clone());
        assert!(
            b.reserved_bond.0.checked_add(value).expect("OVERFLOW") <= ceiling,
            "POLICY_LIMIT"
        );
        b.bond = U128(b.bond.0.checked_sub(value).expect("INSUFFICIENT_BOND"));
        b.reserved_bond = U128(b.reserved_bond.0 + value);
        self.put_balance(owner.clone(), b);
    }
    fn deposit(&mut self, request_id: String, bond: bool) {
        self.new_allowed();
        let amount = env::attached_deposit().as_yoctonear();
        let args = near_sdk::serde_json::json!([U128(amount), bond]);
        if self.once_named_payable(if bond {"deposit_bond"}else{"deposit_funds"},&request_id,&args) {
            return;
        }
        assert!(amount > 0, "INVALID_AMOUNT");
        let owner = env::predecessor_account_id();
        let mut b = self.get_balance(owner.clone());
        if bond {
            b.bond = U128(b.bond.0.checked_add(amount).expect("OVERFLOW"))
        } else {
            b.free = U128(b.free.0.checked_add(amount).expect("OVERFLOW"))
        }
        self.put_balance(owner, b);
        self.done(request_id, "deposited");
    }
    fn once(&mut self, id: &str, args: &near_sdk::serde_json::Value) -> bool {
        self.begin_storage();
        assert!(id.len() >= 8 && id.len() <= 128, "INVALID_REQUEST_ID");
        let key = format!("{}:{}", env::predecessor_account_id(), id);
        self.validate_args(args);
        let payload = env::sha256(near_sdk::serde_json::to_string(args).unwrap().as_bytes());
        let h = near_sdk::serde_json::to_string(&payload).unwrap();
        if let Some(prior) = self.operations.get(&key) {
            assert_eq!(prior.payload_hash, h, "IDEMPOTENCY_CONFLICT");
            return true;
        }
        self.operations.insert(
            key,
            Operation {
                payload_hash: h,
                outcome: "pending".into(),
            },
        );
        false
    }
    fn once_named(&mut self,method:&str,id:&str,args:&near_sdk::serde_json::Value)->bool {self.once(id,&near_sdk::serde_json::json!([method,args]))}
    fn once_named_payable(&mut self,method:&str,id:&str,args:&near_sdk::serde_json::Value)->bool {self.once_payable(id,&near_sdk::serde_json::json!([method,args]))}
    fn once_payable(&mut self, id: &str, args: &near_sdk::serde_json::Value) -> bool {
        let repeated = self.once(id, args);
        if repeated {
            let value = env::attached_deposit().as_yoctonear();
            if value > 0 {
                self.credit(&env::predecessor_account_id(), value);self.finish_storage();
            }
        }
        repeated
    }
    fn done(&mut self, id: String, outcome: &str) {
        let key = format!("{}:{}", env::predecessor_account_id(), id);
        self.operations.get_mut(&key).unwrap().outcome = outcome.into();
        self.finish_storage();
    }
    fn emit(&self, event: &str, id: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({"standard":"agent_market","version":"1.0.0","event":event,"data":[{"id":id,"actor":env::predecessor_account_id(),"time":U64(self.now()),"book":"TESTNET","value":data}]})
        ));
    }
    fn settle(&mut self, id: &str, award_bps: u16, penalty_bps: u16, fallback: bool) {
        assert!(award_bps <= 10000 && penalty_bps <= 10000, "INVALID_AWARD");
        let mut j = self.job(id);
        assert!(
            !["OPEN", "SETTLED", "REFUNDED", "CANCELLED"].contains(&j.state.as_str()),
            "INVALID_STATE"
        );
        for child in &j.children {
            assert!(
                ["SETTLED", "REFUNDED", "CANCELLED"].contains(&self.job(child).state.as_str()),
                "CHILDREN_OPEN"
            );
        }
        let native = self.native_jobs.contains_key(id);
        let price = if native || j.parent.is_some() { 1 } else if fallback {
            j.funding_price.0
        } else {
            self.valid_price();
            self.price.0
        };
        let owed = if j.parent.is_some() {
            j.escrow.0
        } else if native {
            j.n0.0
        } else if award_bps == 0 {
            0
        } else {
            muldiv(j.usd_micro.0, Q, price, true)
        };
        let award = muldiv(owed.min(j.escrow.0), u128::from(award_bps), 10000, false);
        let fee = if j.parent.is_some() {
            0
        } else {
            muldiv(award, 1000, 10000, false)
        };
        let refund = j.escrow.0 - award;
        let penalty = muldiv(j.bond.0, u128::from(penalty_bps), 10000, false);
        let owner = j.creator.clone().unwrap();
        self.credit(&j.client, refund + penalty);
        self.credit(&owner, award - fee);
        self.credit(&self.admin.clone(), fee);
        let mut b = self.get_balance(owner.clone());
        b.reserved_bond = U128(
            b.reserved_bond
                .0
                .checked_sub(j.bond.0)
                .expect("BOND_INVARIANT"),
        );
        b.bond = U128(b.bond.0 + j.bond.0 - penalty);
        self.put_balance(owner, b);
        j.state = if award_bps == 0 {
            "REFUNDED"
        } else {
            "SETTLED"
        }
        .into();
        j.version += 1;
        j.settlement = Some(Settlement {
            award: U128(award),
            fee: U128(fee),
            refund: U128(refund),
            creator_credit: U128(award - fee),
            penalty: U128(penalty),
            shortfall: owed > j.escrow.0,
            fallback_used: fallback,
        });
        if let Some(parent) = &j.parent {
            if refund > 0 {
                let mut root = self.job(parent);
                root.child_spent = U128(root.child_spent.0 - refund);
                self.put_job(parent.clone(), root);
            }
        }
        self.emit(
            "job_settled",
            id,
            near_sdk::serde_json::to_value(&j.settlement).unwrap(),
        );
        self.put_job(id.into(), j);
    }
}
