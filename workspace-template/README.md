# Orby 1.4.1

Current guide: [Complete real demo and setup](backend/docs/RELIABILITY_1_4_1.fa.md). Run `npm run local` from backend. While the local database is running, `npm run demo:seed:samples` adds the isolated 15-job Demo / Sample workspace.

## Historical entry notes

# Orby 1.4

Run `npm run local` from `backend`. The launcher starts PostgreSQL, API, worker, Angular and a configured local model together. [Real demo guide](backend/docs/DEMO_1_4.fa.md), [verification](backend/docs/VERIFICATION.md), [full continuous video](backend/docs/demo-1.4/). Source-only simulation requires Git and Node.js 24 (22.19 supported). For real local inference, stop the app, run `npm run demo:model:setup` in backend, then restart. Testnet requires deployment-owner configuration; no private keys are distributed.

# Orby

پیاده‌سازی محلی بر اساس بستهٔ تحویل: فرانت **Angular**، بک **Node.js** و دیتابیس **PostgreSQL**. رابط انگلیسی، ریسپانسیو، با حالت روشن، تیره و خودکار.

دو پوشهٔ برنامه مستقل‌اند و هرکدام `package.json`، lockfile و README خودشان را دارند:

```text
frontend/                 Angular application
backend/                  API, worker, agents, migrations, tests
  contracts/orby-market/ Rust NEAR testnet contract
  contracts/uploader/     Owner-only staged deployer
handoff/                  Original developer handoff
start.ps1                 Local startup
stop.ps1                  Stop only recorded project processes
```

## اجرا در ویندوز

پیش‌نیاز: Git و Node.js نسخهٔ 24 همراه npm. برای دریافت و اجرای پروژه از GitHub:

```powershell
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm run local
```

ریپوها خصوصی‌اند و اجراکننده باید به هر دو دسترسی داشته باشد. لانچر نسخهٔ هماهنگ فرانت را خودکار می‌گیرد؛ نصب وابستگی‌ها، ساخت برنامه و ایجاد دیتابیس هم خودکار است. در نسخهٔ کلون‌شده فایل `start-local.cmd` همین کار را انجام می‌دهد. راهنمای کامل فارسی: [QUICKSTART.fa.md](backend/QUICKSTART.fa.md).

روی `start.cmd` دوبارکلیک کنید؛ دیتابیس، بک، worker و فرانت با هم اجرا می‌شوند و مرورگر باز می‌شود. برای توقف، `stop.cmd` را اجرا کنید. دستور معادل از همین پوشه:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

آدرس: `http://127.0.0.1:4200`. این اسکریپت PostgreSQL محلی، migration، دادهٔ دمو، API، worker و فرانت را اجرا می‌کند. خروجی سرویس‌ها در همان ترمینال دیده می‌شود و داده‌ها در `backend/.data` می‌مانند. اسکریپت پورت اشغال‌شده را تصاحب نمی‌کند.

```powershell
powershell -ExecutionPolicy Bypass -File .\stop.ps1
```

از Settings گزینهٔ `Switch demo account` را بزنید. حساب `alex.demo` مشتری است؛ `writer.demo` سازندهٔ Brief Writer و `operator.demo` ادمین است. دموی محلی با **simNEAR** اجرا می‌شود. موجودی دمو، توکن شبکه نیست.

## محدوده

بازار ایجنت، ساخت کار و معیار پذیرش، پیشنهاد قیمت، پیش‌نمایش مالی منقضی‌شونده، تضمین و Escrow، اجرای زیرایجنت، تحویل و چک قطعی، اصلاح، اختلاف و رأی ادمین، تسویه، دفتر مالی، برداشت، شواهد، گزارش‌ها و تنظیمات ظاهر در برنامه پیاده شده‌اند.

کارهای جدید با مبلغ ثابت NEAR توافق می‌شوند؛ نرخ زندهٔ USD فقط برای نمایش است. توافق‌های قدیمی منطق مرجع خود را حفظ می‌کنند. مدل زبانی با Ollama اختیاری است؛ بدون آن خروجی با برچسب `Deterministic demo` ساخته می‌شود. اعتبار نسخهٔ پایه، پیش‌نمایش تأمین مالی و چرخهٔ استخر **شبیه‌سازی** است. وام واقعی P1، endpoint خارجی، TEE، مین‌نت و Intents جزو این تحویل پایه نیستند.

اتصال تست‌نت فقط وقتی واقعی محسوب می‌شود که قرارداد مستقر، شناسهٔ قرارداد تنظیم، worker اجرا و رسید شبکه تأیید شده باشد. وضعیت دقیق تست‌ها و استقرار در `VERIFICATION.md` ثبت می‌شود.

راهنمای جزئی: [فرانت](frontend/README.md)، [بک و قرارداد](backend/README.md). فایل‌های `.env`، `.data`، کلیدها و دیتابیس محلی از Git حذف شده‌اند؛ پوشه‌های برنامه را بدون این داده‌های خصوصی منتقل کنید.

گزارش تغییرات و آزمون نسخهٔ Orby 1.1: [ORBY_RELEASE.fa.md](backend/docs/ORBY_RELEASE.fa.md).
