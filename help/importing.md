---
title: Importing contacts from Google
summary: Bringing your existing Google contacts into TinyCld
tags: [import, google, takeout, vcf]
order: 90
---

## What you can import

The **Google Takeout Import** package (a separate optional install) can bring your existing Google contacts into TinyCld. Each contact arrives with its phone number, email address, company, title, and notes mapped to TinyCld fields.

Imports are owned by your TinyCld account, so imported contacts go into *your* personal address book, not a shared one.

## To import

1. Make sure the **Google Takeout Import** package is installed. If you don't see **Import from Google** in your settings, it isn't — installing packages is done by your server's owner, so ask them.
2. Go to [google.com/takeout](https://takeout.google.com/), select **Contacts**, request the export, and download the resulting `.zip` when Google emails you the link.
3. In TinyCld, open **Settings → Import from Google** and click **Select Takeout Files**. A file picker opens; you can select several `.zip` files at once if Google split your export.
4. The importer scans the archives, detects that they contain contacts, and shows a toggle per detected service with the contact count next to it.
5. Click **Start Import** and watch the progress. **Change Files** goes back to the picker.

An import can cover up to 8 GB of uncompressed data across all the selected zips; a larger export is refused up front with a message rather than attempted.

## How deduplication works

The importer **skips** contacts you already have rather than updating them, so re-importing the same Takeout zip — or a later export that includes the same person — leaves your existing record untouched instead of creating a duplicate.

A contact counts as already present when:

- a contact with the same `vcard_uid` exists (Google keeps the same UID across exports of the same person), or
- the card has no UID but a contact in your address book has the same email address, or
- the card has neither UID nor email but a contact in your address book has the same first and last name.

A contact that doesn't match any of those is created, and gets a generated `vcard_uid` if the card had none. Because existing contacts are skipped, edits you make in TinyCld survive a re-import — but changes made on the Google side after your first import don't come across.

## What gets imported

- **Names** — first, last (from the `N` field, with `FN` fallback).
- **Email** — the first email in the Google contact's email array.
- **Phone** — the first phone number.
- **Company** — `ORG` field.
- **Job title** — `TITLE` field.
- **Notes** — `NOTE` field, with formatting preserved as plain text.

## What doesn't get imported

- **Photos** — Google contacts can have photos; TinyCld doesn't store contact photos. The initial-based avatar in the UI is generated from the name.
- **Multiple emails / phones / addresses** — only the first of each is imported (TinyCld stores one of each).
- **Custom Google fields** (relationships, websites, IM handles, etc.) — dropped.
- **Groups** — Google's contact groups don't map to TinyCld [labels](help://contacts:labels). After import, label contacts yourself if you want to group them.

## Importing a vCard file instead

If you have a `.vcf` file from another address book rather than a Takeout zip, use the command line tool — `tinycld contacts import contacts.vcf`. There is no in-app button for vCard files. See [Contacts from the command line](help://contacts:command-line).

## See also

- [CardDAV](help://contacts:carddav) — for syncing with Google Contacts continuously (via DAVx5 or Apple Contacts), instead of one-shot imports
- [Adding contacts](help://contacts:adding-contacts)
