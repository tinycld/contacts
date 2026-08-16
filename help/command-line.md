---
title: Contacts from the command line
summary: List, search, edit, and back up your address book from a terminal with the tinycld CLI.
tags: [cli, terminal, automation, vcard, export, import, backup]
order: 110
---

The `tinycld` command line tool includes a `contacts` command group when the
Contacts package is installed. To download the tool and log in, see
[Command line tool](help://core:command-line). Everything below assumes you
are logged in.

Contacts are addressed by id. Ids are shown in the last column of `list`,
`search`, and `show`.

## Browsing and searching

```
tinycld contacts list                    # your address book
tinycld contacts list --favorites        # only starred contacts
tinycld contacts search ada              # full-text search
tinycld contacts show cnt123             # one contact, every field
```

`search` matches names, email addresses, phone numbers, companies, and notes.
It never matches contacts in your Trash — use `list --trashed` for those. See
[Searching contacts](help://contacts:search).

## Adding and editing

```
tinycld contacts add --first Ada --last Lovelace --email ada@example.com
tinycld contacts add --first Grace --company Navy --favorite
tinycld contacts edit cnt123 --phone 555-0100
tinycld contacts edit cnt123 --notes "Met at the conference" --favorite
```

`--first` is required when adding; every other field is optional. `edit` sends
only the flags you pass, so unmentioned fields keep their values. To clear a
field, pass an empty string:

```
tinycld contacts edit cnt123 --phone ""
```

## Deleting and restoring

```
tinycld contacts rm cnt123               # move to your Trash
tinycld contacts list --trashed          # what you have trashed
tinycld contacts edit cnt123 --restore   # put it back
tinycld contacts rm cnt123 --permanent   # delete for real
```

`rm` moves a contact to your Trash, where it stays restorable — the same Trash
the app shows. `--permanent` deletes the record outright and cannot be undone;
it asks for confirmation first, so pass `--yes` in scripts. See
[Favorites, deletion, and restore](help://contacts:favorites-and-deletion).

## Backing up and transferring

```
tinycld contacts export --out contacts.vcf   # write a vCard file
tinycld contacts export > backup.vcf         # or to stdout
tinycld contacts import contacts.vcf         # read one back in
```

Export writes every contact in your address book as a standard vCard (`.vcf`)
file, which any other address book application can read. Contacts in your
Trash are never exported.

Import matches each card on its UID, so re-importing a file you exported
updates those contacts instead of duplicating them. A card that cannot be
parsed is reported and skipped rather than failing the whole file, and the
command names what it skipped.

To keep an address book continuously in sync rather than copying it once, use
CardDAV instead — see
[Connecting an address book client](help://contacts:carddav).

## Scripting

Every command accepts `--json` for stable, machine-readable output:

```
tinycld contacts list --json | jq '.[].email'
tinycld contacts search acme --json | jq '.[].id'
```
