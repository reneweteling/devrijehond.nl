web: pnpm --filter web exec next start -p $PORT -H 0.0.0.0
# Release runs on every deploy: ensure PostGIS + apply migrations, then re-seed.
# The seed wipes community content (spots, votes, reviews, non-admin users) and
# rebuilds the demo dataset, so each deploy starts from a clean, known state.
release: pnpm --filter @devrijehond/db db:deploy && pnpm --filter @devrijehond/db db:seed
