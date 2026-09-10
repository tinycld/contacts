---
title: Getting started with Contacts
summary: A quick tour of your contact list and the Directory
tags: [intro, basics, tour]
order: 10
---

## What Contacts is

Contacts is your personal address book on this server. Every contact you create is **yours** — not visible to anyone else with an account here. Each person on the server has their own private address book.

If your account is suspended, you lose access to your contacts (in the app, over CardDAV, and from the command line) until an owner or admin re-enables it. The contacts themselves are kept.

The same contacts are also available through CardDAV, so you can read and write them from Apple Contacts, GNOME Contacts, Thunderbird, DAVx5, or any other CardDAV client.

## The sidebar

- **+ Create contact** — opens the new-contact form.
- **Contacts** — your full address book, with a count.
- **Favorites** — only the contacts you've starred.
- **Directory** — *people on this server* (everyone with an account), not your contacts. Useful for seeing roles and finding someone's email. See [Directory](help://contacts:directory).
- **Deleted** — soft-deleted contacts, recoverable for as long as you keep them. See [Favorites, deletion, and restore](help://contacts:favorites-and-deletion).
- **Labels** — colored tags you can apply to contacts. Same label system used by other packages. See [Labels](help://contacts:labels).

## A contact record

Each contact has: first name (required), last name, company, job title, email, phone, notes, and a favorite flag. Behind the scenes each contact also gets a stable `vcard_uid` so re-imports from Google Takeout or other CardDAV clients deduplicate cleanly instead of creating copies.

## Where to go next

- [Adding contacts](help://contacts:adding-contacts) — the new-contact form
- [Search](help://contacts:search) — finding people fast, from the list or the `/` palette
- [Labels](help://contacts:labels) — colored tags
- [CardDAV](help://contacts:carddav) — connecting Apple Contacts, GNOME, Thunderbird, DAVx5
- [Importing from Google](help://contacts:importing) — bringing your existing contacts in
- [Contacts from the command line](help://contacts:command-line) — scripting, vCard export and import
