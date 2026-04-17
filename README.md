# ملف إنجاز المعلم العماني - نسخة جاهزة للتطبيق

هذه النسخة جاهزة للتشغيل والرفع، وتحتوي على:
- واجهة ملف الإنجاز (`index.html`)
- خادم محلي لإنشاء روابط تقييم قصيرة (`server.ps1`)
- نسخة خادم Python بديلة (`app.py`)
- سكربت تشغيل سريع (`start.bat`)
- سكربت تجهيز نسخة رفع (`build-release.ps1`)

## تشغيل المشروع محليًا

### الطريقة الأسرع (ويندوز)
1. افتح المجلد.
2. شغّل الملف `start.bat`.
3. افتح: `http://localhost:8000`

### أو عبر PowerShell مباشرة
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8000
```

## فحص جاهزية الخادم
- افتح: `http://localhost:8000/health`
- النتيجة المتوقعة:
```json
{"status":"ok"}
```

## تجهيز نسخة رفع (Release)
من داخل المجلد شغّل:
```powershell
powershell -ExecutionPolicy Bypass -File .\build-release.ps1
```

سيتم إنشاء:
- مجلد: `release`
- ملف مضغوط: `enjazy-release.zip`

## ما يجب رفعه للاستضافة
- ملفات `release` كاملة (أو محتوى `enjazy-release.zip`)
- ثم تشغيل `server.ps1` على نفس الخادم (Port مناسب)

## ملاحظات إنتاجية مهمة
- الروابط القصيرة تحفظ البيانات في: `data/portfolios.json`
- لا تشارك منفذ الخادم للعامة بدون عكس عبر Nginx/IIS مع HTTPS
- كلمة المرور لا تُرسل داخل رابط التقييم

## نشر سحابي مباشر (Ubuntu + HTTPS)
- اتبع الملف: `DEPLOY_CLOUD_UBUNTU.md`
- توجد سكربتات جاهزة داخل: `deploy/`

## نشر Vercel مع Google Apps Script
- اتبع الملف: `DEPLOY_VERCEL.md`
- انسخ كود Apps Script من: `google-apps-script/Code.gs`
- أضف متغير البيئة في Vercel:
  - `GAS_WEB_APP_URL`
- الوسائط (صور/فيديو) تُرفع كملفات فعلية في Vercel Blob Storage
- الحسابات وبيانات ملف الإنجاز (حفظ/جلب) أصبحت من قاعدة البيانات عبر Apps Script
