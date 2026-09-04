# Changesets

Every change that should reach npm gets a changeset: `pnpm changeset`, pick a bump, write
the line a reader will see in the changelog.

What happens then is two states of one job on master. With changesets pending, the release
workflow opens or updates a "Version packages" pull request that applies them. With none
pending — which is what merging that pull request leaves behind — it publishes. So master
goes out as soon as it is green, and the only ceremony is merging the version PR.

A change that reaches nobody outside the repository needs no changeset: CI, tests, the
contact sheet, the README's typos.
