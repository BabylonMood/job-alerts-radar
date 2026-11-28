# Job Alerts Radar

[English](README.md) · [Español](README.es.md)

New job offers arrive scattered across five portals and email alerts nobody reviews on time. Job Alerts Radar collects those alerts in a dedicated inbox, cleans and filters them by keywords, and publishes one static dashboard. It is for job seekers and teams running a shared search who want a single feed without scraping portals or violating their terms. A Python script reads the inbox over IMAP, ignores accents and case, sanitizes URLs and tokens, writes `jobs.json`, and GitHub Actions refreshes the GitHub Pages site every 30 minutes. The result is a zero-scraping pipeline built with Python, IMAP, GitHub Actions and static HTML/JS that also drafts application emails without sending them.

## How it works

1. Create a dedicated inbox and enable two-step verification with an app password.
2. Enable email alerts on LinkedIn, Computrabajo, Bumeran, ZonaJobs and Indeed, all pointing to that inbox.
3. Copy `config.example.json` to `config.json` and set `imap_user`, `senders`, `keywords_include` and `keywords_exclude`. Matching ignores accents and case.
4. Add the app password as a GitHub Actions secret and schedule the workflow.
5. The dashboard at `index.html` reads `jobs.json` and shows every offer with a match percentage.

## Files

| File | Purpose |
| --- | --- |
| `scan_email.py` | IMAP reader, parser, filters and sanitizer |
| `config.example.json` | Configuration template |
| `jobs.json` | Generated feed consumed by the dashboard |
| `index.html` | Static dashboard, published on GitHub Pages |

## Privacy

No portal is scraped. Tokens and personally identifiable information are stripped before anything is written to disk, and the generated draft is only created locally — the script never sends an application email.

[Leer en español](README.es.md)
