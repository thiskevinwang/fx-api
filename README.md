# fx-api

FX API that sources data from https://fred.stlouisfed.org/docs/api/fred/.

Requires and API key: https://fredaccount.stlouisfed.org/apikey

## Development

```
npx wrangler dev --test-scheduled

curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```
