---
title: Contact rules
summary: Add contacts automatically when something happens
tags: [rules, automation, workflow]
order: 110
---

Contacts can take part in [automation rules](help://core:rules) two ways: a
rule can start when a contact is added, and any rule can add a contact as one
of its actions.

## When a contact is added

The trigger **A contact is added** fires whenever a new contact is created —
by you, by an import, or by another rule. You can filter on first name, last
name, email, phone, company, job title, and whether it's a favorite.

Pair it with an action from another package: notify yourself when a contact
with a particular company is added, for example.

## When a contact changes

The trigger **A contact changes** fires when someone edits a contact's name,
email, phone, company, job title, notes, or favorite status. It deliberately
ignores bookkeeping: a CardDAV sync assigning an internal identifier, or a
contact being moved to the trash, doesn't count as a change.

## Adding a contact from a rule

The action **Add a contact** creates a contact with the first name, last name,
email, and company you specify. Each of those accepts a placeholder, so the
values can come from whatever started the rule.

The contact belongs to whoever owns the rule.

## The recipe this exists for

**Save everyone who emails you.** When a message arrives, add a contact using
`{{sender_name}}` and `{{sender_email}}`. The `{{ }}` button in the builder
inserts these; they're filled in with the real values when the rule runs.

This needs the mail package installed. If it isn't, the trigger simply won't
appear in the builder's list.

## Duplicates are not checked

**A rule that adds contacts does not look for an existing match.** If the same
person emails you three times and your rule has no conditions, you get three
contacts.

Ways to keep that under control:

- Add a condition so the rule only fires for mail you actually want saved — a
  particular domain, or a subject that marks it as a real enquiry.
- Merge or delete duplicates by hand afterwards (see
  [Favorites and deletion](help://contacts:favorites-and-deletion)).

Automatic duplicate detection may come later; today the rule does exactly what
it's told, every time.

## What rules can't do yet

- **Timing.** Rules react to events as they happen. There's no way to say "if I
  haven't contacted this person in six months" — that needs a scheduled rule
  that can look at existing records, which doesn't exist yet.
- **Updating an existing contact.** A rule can create a contact, but it can't
  find one and change it. Only the record that started the rule can be updated.
