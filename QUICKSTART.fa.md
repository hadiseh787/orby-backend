# اجرای محلی

Version 1.3: the startup command is unchanged. Run `npm run local` from the backend folder. It starts PostgreSQL, API, worker and Angular together. New tools are in Workspace tools; receipts are in each job. Full review-v2 report: `docs/REVIEW_V2_RELEASE.fa.md`.

پیش‌نیاز: Git و Node.js نسخهٔ 24 همراه npm. نصب جداگانهٔ Angular، PostgreSQL، Docker، Rust یا Ollama برای اجرای محلی لازم نیست.

هر دو ریپو خصوصی‌اند؛ اکانت GitHub اجراکننده باید به هر دو دسترسی داشته باشد و Git با همان اکانت وارد شده باشد. نصب اول اینترنت می‌خواهد.

```powershell
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm run local
```

در ویندوز به‌جای دستور آخر می‌توان روی `start-local.cmd` دوبارکلیک کرد. نصب وابستگی‌ها، دریافت نسخهٔ هماهنگ فرانت، ساخت برنامه، ایجاد تنظیمات و دیتابیس، migration و دادهٔ اولیه خودکار انجام می‌شود. فرانت، API و worker با همان یک ترمینال اجرا می‌شوند. ترمینال را باز نگه دارید.

آدرس برنامه: **http://127.0.0.1:4200**

برای ورود، `Open local demo` و حساب `Alex · Client` را انتخاب کنید. این محیط با موجودی شبیه‌سازی اجرا می‌شود و کیف پول نمی‌خواهد.

توقف: `Ctrl+C` در ترمینال، `npm run local:stop` یا فایل `stop-local.cmd`. اجرای دوباره اطلاعات قبلی را حفظ می‌کند. دیتابیس در `.data/postgres` ذخیره می‌شود.

اگر هر دو ریپو را ZIP گرفته‌اید، آن‌ها را کنار هم استخراج کنید؛ در این حالت برای اجرا فقط Node.js همراه npm لازم است. نام‌های پوشهٔ GitHub مانند `orby-frontend-main` هم شناسایی می‌شوند.

اگر پورت‌ها اشغال‌اند:

```powershell
node scripts/local.mjs --port 4300 --db-port 5434
```

فایل‌های خصوصی و کلیدهای تست‌نت داخل ریپو قرار ندارند. اجرای واقعی تست‌نت تنظیمات و کلیدهای مخصوص خودش را می‌خواهد؛ تولید خروجی با مدل زبانی هم به Ollama و مدل نصب‌شده نیاز دارد. اجرای پیش‌فرض از ایجنت قطعی محلی استفاده می‌کند. جزئیات پیاده‌سازی و محدودهٔ تست در `docs/VERIFICATION.md` ثبت شده است.
