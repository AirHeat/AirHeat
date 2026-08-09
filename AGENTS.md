# AirHeat Engineering Specification

This file is the permanent engineering specification for the AirHeat repository. These rules apply to all code, data, tests, migrations, and releases unless the user explicitly approves a narrower exception.

## Domain model

The non-negotiable AirHeat domain hierarchy is:

**Customer → Property → Equipment → Service**

- Customer contains CRM and contact data only.
- One Customer may own multiple Properties.
- One Property may contain multiple Equipment items.
- Every Service must ultimately belong to one specific Equipment item.
- Warranty belongs to Equipment, not Customer.
- Do not duplicate service or warranty logic into Customer or Property views or domain objects.
- Equipment service history must prefer explicit `equipmentId` ownership. Legacy fallback resolution may be used only when explicit ownership is absent.
- New Services must include `propertyId` and `equipmentId` whenever their context is known.

## Legacy data compatibility

- Preserve all legacy and imported data unless an explicit migration is approved.
- Never silently merge duplicate Customers.
- Never destructively rewrite legacy localStorage records as part of compatibility work.
- All dates must be preserved exactly during migrations.
- Declined, expired, two-year, and active warranties must remain distinguishable.
- Future, pending, missed, and completed Services must be preserved.
- Existing Services without `propertyId` or `equipmentId` must remain usable through explicit, testable compatibility logic.

## Navigation

- Google Maps and Waze must use GPS coordinates only when both latitude and longitude are valid.
- When valid coordinates are unavailable, navigation must fall back to the complete Property or Customer address.
- Never generate `null,null` or partial-coordinate navigation URLs.

## Safety and release rules

- Never modify `clients-data.js` unless explicitly instructed.
- Never perform a destructive data migration without a rollback and export strategy.
- Before every release, verify Dashboard, Customers, Properties, Equipment, and Services.
- Test navigation and Service actions before every release.
- Preserve imported record counts and verify `clients-data.js` integrity when changing domain or persistence behavior.
- Do not commit or push unless explicitly approved.
