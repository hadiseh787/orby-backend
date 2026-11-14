// Compatibility entry point: use the resumable, cross-platform V3 provisioner.
// Existing incompatible code is preserved; upgrades require an explicit reviewed migration.
if(process.argv.includes('--upgrade-only'))throw Error('Automatic code upgrades are not part of setup. Review the existing deployment and versioned artifacts explicitly; no contract was overwritten.');
await import('./setup-testnet.js');
