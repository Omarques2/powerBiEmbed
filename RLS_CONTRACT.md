# RLS Contract

## Purpose
Define the RLS naming, role, and PBIX checklist for customer isolation using CUSTOMDATA.

## Fixed constants
- Role name: CustomerRLS
- Identity carrier: CUSTOMDATA() == customerId
- customerId: UUID string

## Naming
- target_key: snake_case ASCII (example: instituicao_financeira)
- Dimension table: Dim_<TargetKey>
- Security table: Sec_<TargetKey> (filtered from sec_rls_base)

## Default behavior
- default_behavior = allow
- If no include rules exist for a target, allow all values.
- Exclude rules always override allow.

## PBIX checklist
1. Import sec_rls_base (from database).
2. For each target:
   - Create Sec_<TargetKey> filtered by target_key.
   - Create Dim_<TargetKey> = DISTINCT(Fact[<fact_column>]).
   - Create relationship: Dim_<TargetKey>[Value] (1) -> Fact[<fact_column>] (*).
3. Create role CustomerRLS.
4. Add DAX filter on Dim_<TargetKey> using CUSTOMDATA().

## DAX template (text/uuid)
VAR customer = CUSTOMDATA()
VAR inc = CALCULATETABLE(VALUES(Sec_Target[value_text]), Sec_Target[customer_id] = customer, Sec_Target[op] = "include")
VAR exc = CALCULATETABLE(VALUES(Sec_Target[value_text]), Sec_Target[customer_id] = customer, Sec_Target[op] = "exclude")
VAR hasInc = COUNTROWS(inc) > 0
VAR isInc = IF(hasInc, Dim_Target[Value] IN inc, TRUE())
VAR isExc = Dim_Target[Value] IN exc
RETURN isInc && NOT isExc

## DAX template (int)
Replace value_text with value_int and ensure the dimension column is numeric.

## Operational notes
- RLS only restricts Viewer in workspace.
- RLS applies at dataset level (affects all reports on that dataset).
- Embed com RLS exige effective identity; se houver multiplas fontes, todas devem estar em Import e suportar effective identity.
- Se falhar, reduzir para uma unica fonte suportada para isolar o problema.
