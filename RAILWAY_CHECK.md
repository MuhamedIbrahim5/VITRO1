# تحقق من Railway

## إذا `/health` يظهر فقط:
```json
{"status":"ok","timestamp":"...","uptime":...}
```
**=SERV قديم.** لم يُبنَ من آخر كود GitHub.

## يجب أن يظهر:
```json
{
  "status": "ok",
  "version": "2026-05-21-youtube-fix",
  "cloud": true,
  "youtubeCookies": true,
  "instagramCookies": true,
  "facebookCookies": true,
  "lanIp": null
}
```

## إصلاح Railway

1. **Settings** → **Source** → Repo: `MuhamedIbrahim5/VITRO1` → Branch: `main`
2. **Deployments** → **⋯** → **Redeploy** (أو **Deploy latest commit**)
3. فعّل **Clear build cache** إن وُجد
4. انتظر Build ينتهي (3–8 دقائق)
5. افتح `/health` مرة أخرى

## Variables (بعد نجاح النشر)
- `FACEBOOK_COOKIES_BASE64`
- `INSTAGRAM_COOKIES_BASE64`
- `YOUTUBE_COOKIES_BASE64` (اختياري)
