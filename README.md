# fx-api

This is a foreign exchange data api template. An example can be viewed at https://monies.dev

> [!IMPORTANT]
> This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.

## Development

Requires a Fred API key: https://fredaccount.stlouisfed.org/apikey. Also see https://fred.stlouisfed.org/docs/api/fred/.

```bash
# run w/ schedule handler
bnpx wrangler dev --test-scheduled
# trigger it
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## Testing

```bash
bun run test
```

## Linting and formatting

```bash
bun lint
bun format
```

## Deployment

```bash
# one time
bunx wrangler secret put FRED_API_KEY

bun run deploy
```

## API

See [docs.md](./src/docs.md) for API docs.
