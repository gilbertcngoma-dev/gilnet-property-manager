# Requested additions
- [x] Install button, room service, Pending payments, stay extensions, staff approval, Excel reports, guest phone/requests, reservations, departments, offline-first rebuild, cloud sign-in + two-way sync, setup wizard, receipt numbers on stays, PDF reports on Reports page.
- [ ] Owner page: one screen showing every lodge's live status (today's guests, sales, cash, rooms, last check-in, last sync with green/yellow/red).
- [ ] Settings upgrades: master cloud email, last sync + next sync countdown, Support section (mailto to support.gilnet.property.manager@gmail.com), "Check Cloud Backup" comparing cloud vs local record counts.
- [ ] Windows app details: product name "Chaniche Lodge", GILNET copyright/author, Help menu with About dialog and Email Support button.
- [ ] Receipt numbers on restaurant sales.
- [ ] Google Drive backups (needs each lodge's Google account connected — deferred).
- [ ] Transfer Property Ownership — risky as specced (cloud records belong to the old account and would be stranded); offer support-email assisted transfer instead.
- [ ] PINs synced to cloud so they restore on a new computer.
- Note: user asked for a localStorage rebuild in src/pages/Index.tsx — keeping the existing IndexedDB system (safer, already working) and this TanStack app's structure; intent is preserved.
