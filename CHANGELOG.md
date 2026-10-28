# Changelog

## 1.2.1 — 2026-10-28

- Simplified the review text exported to ChatGPT.
- Corrected SAN move-number formatting when Black starts (`1... Nxf4 2. Nxf4 Qxc7`).
- Added extension icons, MIT license, privacy policy, and public repository documentation.
- Kept the native Lichess SAN-first recording logic from 1.2.0.

## 1.2.0

- Prefer native move-tree SAN when available; use board transitions as fallback.
- Provide three primary actions and put diagnostics under advanced settings.