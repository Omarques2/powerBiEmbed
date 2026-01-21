# RLS Contract

## Purpose
Define the RLS naming, role, and PBIX checklist for customer isolation using CUSTOMDATA and user overrides via USERNAME.

## Fixed constants
- Role name: CustomerRLS
- Identity carrier:
  - CUSTOMDATA() == customerId (customer scope)
  - USERNAME() == userId (user scope)
- customerId: UUID string
- userId: UUID string

## Naming
- target_key: snake_case ASCII (example: instituicao_financeira)
- target_key must be unique globally (Sec_<TargetKey> is a database view name).
- Dimension table: Dim_<TargetKey>
- Security table: Sec_<TargetKey> (filtered from sec_rls_base)

## Default behavior
- default_behavior = allow
- If no include rules exist for a target, allow all values.
- Exclude rules always override allow.

## PBIX checklist
1. Import sec_rls_base (from database).
2. Ensure columns: customer_id, user_id, target_key, op, value_*.
3. For each target:
   - Create Sec_<TargetKey> filtered by target_key.
   - Create Dim_<TargetKey> = DISTINCT(Fact[<fact_column>]).
   - Create relationship: Dim_<TargetKey>[Value] (1) -> Fact[<fact_column>] (*).
4. Create role CustomerRLS.
5. Add DAX filter on Dim_<TargetKey> using CUSTOMDATA() + USERNAME().

### Optional shortcut (tabelas prontas)
If the database already provides Sec_<TargetKey> and Dim_<TargetKey>:
- Skip steps 1-3 and load those tables directly.
- Ensure customer_id/user_id are Text and value_* matches target value_type.
Note:
- The backend creates a Sec_<TargetKey> view automatically when a target is saved.
- The backend also keeps sec_rls_base as a view sourced from rls_rule/rls_target.

## DAX template (text/uuid)
VAR user = USERNAME()
VAR customer = CUSTOMDATA()
VAR userInc = CALCULATETABLE(VALUES(Sec_Target[value_text]), Sec_Target[user_id] = user, Sec_Target[op] = "include")
VAR userExc = CALCULATETABLE(VALUES(Sec_Target[value_text]), Sec_Target[user_id] = user, Sec_Target[op] = "exclude")
VAR hasUser = COUNTROWS(userInc) + COUNTROWS(userExc) > 0
VAR inc = CALCULATETABLE(VALUES(Sec_Target[value_text]), Sec_Target[customer_id] = customer, Sec_Target[op] = "include")
VAR exc = CALCULATETABLE(VALUES(Sec_Target[value_text]), Sec_Target[customer_id] = customer, Sec_Target[op] = "exclude")
VAR hasInc = COUNTROWS(inc) > 0
VAR isInc = IF(hasUser, Dim_Target[Value] IN userInc, IF(hasInc, Dim_Target[Value] IN inc, TRUE()))
VAR isExc = IF(hasUser, Dim_Target[Value] IN userExc, Dim_Target[Value] IN exc)
RETURN isInc && NOT isExc

## DAX template (int)
Replace value_text with value_int and ensure the dimension column is numeric.

## Operational notes
- RLS only restricts Viewer in workspace.
- RLS applies at dataset level (affects all reports on that dataset).
- Embed com RLS exige effective identity; se houver multiplas fontes, todas devem estar em Import e suportar effective identity.
- Se falhar, reduzir para uma unica fonte suportada para isolar o problema.
- User rules override customer rules when any user-specific rule exists.
