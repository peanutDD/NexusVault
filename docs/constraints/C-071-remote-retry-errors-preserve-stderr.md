# C-071: Remote retry failures must preserve stderr for fallback classification

## Rule

Retry helpers around remote `git`/`gh` operations must include the final command stderr in the returned error.

## Why

`commit_and_push_in` decides whether to fall back from `git push` to the GitHub API by classifying transient network text such as `Empty reply from server`. If the retry helper returns only status text and drops stderr, the fallback path cannot distinguish network failures from permanent failures and will fail instead of publishing through the API fallback.

## Enforcement

`repo::tests::commit_and_push_falls_back_to_github_api_when_git_push_network_fails` must keep proving that repeated `git push` network errors trigger the GitHub API fallback.
