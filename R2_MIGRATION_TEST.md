# Cloudflare R2 media migration (test branch)

This branch changes the existing Vercel-style media API handlers to use Cloudflare R2 through its S3-compatible API. It does not migrate existing objects automatically and must not be merged into Production until tested.

## Required environment variables

Configure these only in the **Preview** environment for the test deployment first:

- `R2_ACCOUNT_ID`: Cloudflare account ID.
- `R2_BUCKET_NAME`: `pixel-nira-media`.
- `R2_ACCESS_KEY_ID`: Access Key ID from an R2 API token scoped to this bucket.
- `R2_SECRET_ACCESS_KEY`: Secret Access Key from that token.

Do not commit these values to GitHub or share them in chat. The S3-compatible endpoint is generated as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.

## Important hosting note

The current production code uses Vercel-style API handlers (`req`, `res`, and `process.env`). A Cloudflare Worker R2 binding such as `MEDIA_BUCKET` is **not automatically available** to those Vercel functions. This implementation uses the R2 S3-compatible API and the four environment variables above, so it can be tested in the Vercel Preview environment without moving website hosting.

The Cloudflare Worker binding added in the dashboard is not used by these API handlers. Do not route the public domain to the Worker as part of this test.

## Scope of changes

- `api/media/r2.js`: S3-compatible R2 client, presigned upload URL, object inspection, read, and delete.
- `api/media/upload-token.js`: issues 10-minute presigned PUT URLs and verifies the uploaded object size/type before registering it in Neon.
- `api/media/file.js`: serves private R2 objects only after the existing Neon publication/admin authorization check.
- `api/media/manage.js`: deletes R2 objects only after the existing saved/published-reference guard.
- `api/media/list.js`, admin authentication, and Neon schema are unchanged.
- 30 MB size limit and allowed image types are retained.

## Before enabling the test

1. Set the four environment variables in Preview only.
2. Confirm the Preview deployment is using this branch.
3. Test upload, registration, display, brand filtering, and deletion with a disposable image.
4. Confirm existing published Vercel Blob images still display. This branch reads from R2, so existing Vercel Blob objects will not be found until a separate migration/backfill or a temporary dual-read fallback is implemented.
5. Do not promote or merge this branch into Production until the legacy-image compatibility strategy and all tests are confirmed.

## Known migration limitation

Existing `media_assets.object_key` values still point to Vercel Blob objects. This code assumes objects with those keys exist in R2. Therefore, the migration is not production-ready until legacy media is copied to R2 (preserving object keys) or the read endpoint supports both R2 and Vercel Blob during a transition period.
