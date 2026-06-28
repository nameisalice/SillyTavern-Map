# Security Policy

SillyTavern Atlas is designed to be **safe by default**. This document summarizes the
security posture and how to report vulnerabilities.

## Default posture

- **Declarative actions only.** Atlas executes a small set of declarative, safe
  actions (set location, open nested map, show a toast). Anything more powerful is
  gated behind explicit user opt-in.
- **Raw STScript is disabled by default.** The `allowAdvancedScripts` setting must be
  turned on before any raw STScript action can run.
- **Imported scripts never run automatically.** Map packs imported from untrusted
  sources are marked untrusted. Their script content is shown to the user for explicit
  approval before the first execution, and approval is bound to the map pack checksum
  so a modified pack invalidates prior approval.
- **No `eval`.** Atlas never uses `eval` and never injects unsanitized HTML.
  User-provided text is rendered with `textContent`, not `innerHTML`.
- **Local-first.** The core extension requires no server plugin, database, or cloud
  account. Browser-local map assets stay on the device that created them.
- **No automatic remote requests.** Atlas does not fetch remote resources without
  visible user consent, and it never makes an LLM call on every chat message.

## Credentials

Provider credentials (when AI-assisted generation is added in a later milestone) must
never be stored in map documents, chat metadata, exports, logs, or diagnostics. They
are never embedded in the JavaScript bundle and never sent to an unrelated provider.

## Reporting a vulnerability

Please report security issues privately by opening a private security advisory on the
repository, or by contacting the maintainers directly. Do not open a public issue for
security vulnerabilities. Include:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected versions.

We will acknowledge receipt promptly and coordinate a fix and disclosure timeline.

## Scope

This policy applies to the latest `main` branch and released versions of SillyTavern
Atlas. Issues in dependencies should be reported upstream and tracked here once a fix
is available.
