# Orby standalone handoff package

Status: proposed design for review; the application and contract are not implemented yet. The rights and treasury project is unchanged in this package.

Reading order:

1. `PRODUCT_SPEC.pdf` or its HTML version: scope, financial corrections, features, the contract, API, data, 48 acceptance scenarios and the development plan.

2. `DESIGN_SYSTEM.pdf`: color, sizing, components, English copy, the main screens and responsive behavior.

3. `design/preview.html`: a fully local, interactive English prototype with six views; open it in a browser. It sends no transactions.

4. The `examples` folder: sample messages, manifests, financial rules and test vectors. The `contracts` folder contains an ABI description, not a deployment-ready contract.

The editable source of each document is available with an `.md` extension. The design system's CSS and JSON files are in the `design` folder. The display font is embedded in the HTML/PDF files. `FONT_LICENSE.txt` holds the font license.

Delivery basis: free tooling and the NEAR testnet; an English UI; Persian source documentation; one developer with the option of a second helper. The main slice is designed for ten days; real credit is the next stage and the total time is longer.

Key decisions: a USD-referenced escrow with a cap, not a dollar guarantee; AI as an auxiliary arbitrator; financial authority in the contract; credit backed by separate collateral; simulation with a separate unit and ledger. These decisions are explained against the input file in section 2 of the product document.

Programming starts once this design baseline is accepted. First run M0 and the signing test, the Rust toolchain and the local model. The application install commands listed in the document are a "future delivery contract" and are not executable in this package.
