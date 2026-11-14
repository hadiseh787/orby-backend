// Compatibility entry point: reconcile the existing owned deployment and limited signer safely.
import {config} from '../src/config.js';
if(!config.contract)throw Error('Configure an owned deployment with npm run setup:testnet first. No runtime key was changed.');
await import('./setup-testnet.js');
