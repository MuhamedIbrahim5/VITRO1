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

## تحديث Railway (فيسبوك + إنستجرام على الموقع)

**يوتيوب وتيك توك** يعملان بدون كوكيز. **فيسبوك وإنستجرام** يحتاجان كوكيز على Railway.

### 1) صدّر الكوكيز للسحابة
```powershell
cd D:\Vitro1
powershell -File scripts\export-railway-all-cookies.ps1
```

### 2) أضف المتغيرات في Railway
مشروع **vitro1-production** → **Variables**:
- `FACEBOOK_COOKIES_BASE64` ← من الملف `www.facebook.com_cookies.txt`
- `INSTAGRAM_COOKIES_BASE64` ← من `cookies.txt` (يجب أن يحتوي sessionid — صدّره من Cookie-Editor على instagram.com)
- `YOUTUBE_COOKIES_BASE64` ← اختياري

### 3) Redeploy
**Deployments** → **Redeploy**

تحقق: https://vitro1-production-be78.up.railway.app/health  
يجب: `"facebookCookies":true` و `"instagramCookies":true`

### كوكيز Facebook (مطلوب)

1. سجّل دخولك على Facebook في المتصفح
2. شغّل `export-facebook-cookies.bat`
3. يُنشأ `www.facebook.com_cookies.txt` — أعد تشغيل السيرفر
4. Railway: انسخ base64 إلى `FACEBOOK_COOKIES_BASE64` ثم Redeploy

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
