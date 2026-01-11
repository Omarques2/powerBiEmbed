# DirectQuery / DirectLake Spike (CUSTOMDATA RLS)

## Objective
Validate if `CUSTOMDATA()` works inside RLS rules when the dataset uses DirectQuery or DirectLake.

## Why this matters
Microsoft documentation indicates `CUSTOMDATA()` may be unsupported in DirectQuery for RLS rules.
If it fails, the embed identity carrier must change (e.g., `USERNAME()` / `USERPRINCIPALNAME()`).

## Test plan (manual)
1. Create or select a dataset using DirectQuery or DirectLake.
2. Create a table `Dim_<TargetKey>` and a role `CustomerRLS`.
3. Apply a DAX filter using `CUSTOMDATA()` (same template as Import mode).
4. Publish and embed with `identities[]` containing:
   - `customData = customerId`
   - `roles = ["CustomerRLS"]`
5. Validate in the embedded report:
   - Customer with include list sees only allowed rows
   - Customer with exclude list does not see excluded rows
6. Record the results below.

## Result (fill in)
- Date:
- Dataset:
- Mode: DirectQuery / DirectLake
- Outcome: PASS / FAIL
- Notes:

## Decision
- If PASS: keep `CUSTOMDATA()` as identity carrier.
- If FAIL: migrate to `USERNAME()` / `USERPRINCIPALNAME()` and map identity via `identities[].username`.
