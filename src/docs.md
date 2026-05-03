# monies.dev

## Sitemap

- `GET /docs`
- `GET /docs.md`
- `GET /v1/pairs`
- `GET /v1/rates/:from/:to`
- `GET /v1/schemas/:object`

## Endpoints

### `GET /v1/pairs`

Returns the FX pairs currently available from the API.

### `GET /v1/rates/:from/:to`

Returns observed rates for a currency pair.

Examples:

- `GET /v1/rates/EUR/USD`
- `GET /v1/rates/EUR/USD?start=2026-01-01&end=2026-04-30`
- `GET /v1/rates/EUR/USD?start=2026-01-01`
- `GET /v1/rates/EUR/USD?end=2026-04-30`
- `GET /v1/rates/EUR/USD?asof=2026-04-13`

Rules:

- Without date query parameters, returns all stored observations for the pair.
- With `start`, `end`, or both, returns stored observations inclusively within those date filters.
- With `asof`, returns the latest stored observation on or before that date.
- Paired `start` and `end` date ranges are capped at one calendar year.
- Rates use `quote_per_base`: units of `to` currency per 1 unit of `from` currency.

### `GET /v1/schemas/:object`

Returns JSON Schema for public API response objects.

Supported objects:

- `error`
- `fx_pair`
- `fx_pair_list`
- `fx_rate`
- `fx_rate_list`
- `list`

## Response Shape

Successful responses use list envelopes:

```json
{
  "object": "list",
  "url": "/v1/rates/EUR/USD",
  "has_more": false,
  "data": [
    {
      "object": "fx_rate",
      "id": "EUR-USD:2026-04-10",
      "from": "EUR",
      "to": "USD",
      "date": "2026-04-10",
      "rate": "1.1723",
      "rate_scale": "quote_per_base",
      "generated_at": "2026-04-13T00:00:00.000Z"
    }
  ]
}
```

This response can be interpreted as, "as of 2026-04-10, 1 EUR would've been roughly equivalent to 1.1723 USD".

Errors use a top-level `error` object with `type`, `code`, and `message`.
