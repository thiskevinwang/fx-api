# FRED Series Copyright Notes

This document records a manual review of the FRED metadata `notes` field for
each source series currently synced by the FX ETL.

Checked via FRED `/fred/series` metadata on 2026-05-03.

## Summary

No synced FX source series had metadata notes containing `Copyright`.

## Series Checked

| Series ID | Served directions    | Metadata notes contain `Copyright` |
| --------- | -------------------- | ---------------------------------- |
| `DEXUSEU` | `EUR-USD`, `USD-EUR` | No                                 |
| `DEXUSUK` | `GBP-USD`, `USD-GBP` | No                                 |
| `DEXUSAL` | `AUD-USD`, `USD-AUD` | No                                 |
| `DEXJPUS` | `USD-JPY`, `JPY-USD` | No                                 |
| `DEXCAUS` | `USD-CAD`, `CAD-USD` | No                                 |
| `DEXSZUS` | `USD-CHF`, `CHF-USD` | No                                 |
| `DEXCHUS` | `USD-CNY`, `CNY-USD` | No                                 |
| `DEXMXUS` | `USD-MXN`, `MXN-USD` | No                                 |
| `DEXINUS` | `USD-INR`, `INR-USD` | No                                 |
| `DEXKOUS` | `USD-KRW`, `KRW-USD` | No                                 |

## Review Criteria

A series should be added to a follow-up section in this document if its FRED
metadata `notes` field contains the word `Copyright`, case-insensitively.
