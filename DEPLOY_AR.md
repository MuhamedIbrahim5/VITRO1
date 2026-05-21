# نشر Vitro (حل مشكلة YouTube على Firebase)

## المشكلة
Firebase يعرض الموقع فقط. التحميل يحتاج **Backend** على Railway.
إذا ظهر: `YouTube requires authentication` → سيرفر Railway **قديم** ولم يُحدَّث.

## الحل السريع (نفس Codex — محلي)

```bash
cd D:\Vitro1
npm start
```

افتح: **http://localhost:3001** (ليس 0.0.0.0)

من الموبايل (نفس الواي فاي): **http://192.168.1.3:3001**

> الموقع على Firebase سيحاول تلقائياً السيرفر المحلي إذا كان شغالاً على نفس الجهاز.

---

## تحديث Railway (للموقع على الإنترنت)

1. افتح https://railway.app/dashboard
2. مشروع **vitro1-production**
3. **Settings** → تأكد الربط مع GitHub repo `VITRO1`
4. **Deployments** → **Redeploy** (أو Deploy Latest)
5. تحقق: https://vitro1-production-be78.up.railway.app/health  
   يجب أن يظهر: `"version":"2026-05-21-youtube-auth-fix-v2"`

### كوكيز Instagram (مطلوب)

1. سجّل دخولك على Instagram في المتصفح
2. شغّل `export-instagram-cookies.bat` (أو استخدم إضافة **Get cookies.txt LOCALLY**)
3. محلي: يُنشأ `cookies.txt` — أعد تشغيل السيرفر
4. Railway: `powershell -File scripts\export-railway-instagram-cookies.ps1`  
   → انسخ إلى `INSTAGRAM_COOKIES_BASE64` → **Redeploy**

### كوكيز YouTube (اختياري)

```powershell
powershell -File scripts\export-railway-cookies.ps1
```

انسخ الناتج إلى Railway → **Variables** → `YOUTUBE_COOKIES_BASE64` → **Redeploy**

---

## نشر Firebase

```bash
npm run deploy:firebase
```

رابط الموقع: https://vitro-hosting-20260520.web.app

---

## GitHub Actions (مرة واحدة)

في GitHub repo → **Settings** → **Secrets** → أضف:
- `RAILWAY_TOKEN` من Railway → Account Settings → Tokens

بعدها كل `git push` يعمل Redeploy تلقائياً.
