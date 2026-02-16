# دليل الاستخدام الكامل - Augments MCP Server

## 🚀 الخطوة 1: تشغيل السيرفر

```bash
cd /Users/emad/augments-mcp-server
npm run dev
```

**النتيجة:**
```
✓ Ready in 16.9s
- Local: http://localhost:3000
- API: http://localhost:3000/api/mcp
```

---

## 🛠 الخطوة 2: إعداد Cline

### الطريقة 1: ملف التكوين (موصى)
```bash
# انسخ محتوى cline_mcp_config.json
cat cline_mcp_config.json
```

### الطريقة 2: يدوياً
1. افتح Cline Settings
2. اذهب إلى **MCP Servers**
3. أضف Server جديد:
   - **Name**: `augments`
   - **Command**: `npx -y mcp-remote http://localhost:3000/api/mcp`
   - **Transport**: `http`

---

## 📋 الخطوة 3: الاختبار

### اختبار الاتصال في Cline:
```
@augments get_api_context query="useEffect cleanup" framework="react"
```

**النتيجة المتوقعة:**
```
# React API Context
Version: 19.0.0

## useEffect
function useEffect(effect: EffectCallback, deps?: DependencyList): void

Parameters:
- effect: EffectCallback - The effect function to run
- deps?: DependencyList - Optional dependency array

Returns: void

Example:
```typescript
useEffect(() => {
  // Cleanup logic
  return () => {
    // Cleanup function
  };
}, []);
```
```

---

## 🎯 الأوامر المتاحة

### 1. جلب API Context
```
@augments get_api_context query="useState" framework="react"
@augments get_api_context query="findMany" framework="prisma"
@augments get_api_context query="useQuery" framework="@tanstack/react-query"
```

### 2. البحث عن APIs
```
@augments search_apis query="state management hook"
@augments search_apis query="database query" frameworks="['prisma','sequelize']"
```

### 3. معلومات الـ Versions
```
@augments get_version_info framework="react" fromVersion="18" toVersion="19"
@augments get_version_info framework="nextjs"
```

### 4. البحث عن Frameworks
```
@augments search_frameworks query="database"
@augments search_frameworks query="state management"
```

### 5. جلب Documentation
```
@augments get_framework_docs framework="prisma"
@augments get_framework_docs framework="react" section="hooks"
```

### 6. سياق متعدد Frameworks
```
@augments get_framework_context frameworks="['react','nextjs']" task_description="build a todo app"
```

---

## 💡 أمثلة عملية

### مثال 1: بناء Form مع React Hook Form
```
@augments get_api_context query="useForm" framework="react-hook-form"
```

### مثال 2: مقارنة Prisma مع Sequelize
```
@augments get_api_context query="findMany" framework="prisma"
@augments get_api_context query="findAll" framework="sequelize"
@augments get_version_info framework="prisma"
```

### مثال 3: تحديث React من 18 إلى 19
```
@augments get_version_info framework="react" fromVersion="18" toVersion="19"
```

### مثال 4: البحث عن State Management
```
@augments search_apis query="global state"
@augments search_frameworks query="state management"
```

---

## ⚙️ المتغيرات المطلوبة (.env)

```bash
# مطلوب للتشغيل المحلي
PORT=3000
HOST=localhost
NODE_ENV=development

# اختياري - GitHub (لأمثلة أكثر)
GITHUB_TOKEN=your_github_token

# اختياري - Minimax (لتحسين query parsing)
MINIMAX_API_KEY=your_minimax_key

# اختياري - Chutes (لأمثلة إضافية)
CHUTES_API_KEY=your_chutes_key
```

---

## 🎯 المميزات

### ✅ 100% مجاني
- Types من npm CDN (unpkg/jsdelivr)
- لا يحتاج API keys
- لا اشتراكات

### ✅ 100% محلي
- البيانات على جهازك
- Kash في `.cache/`
- لا يحتاج Redis

### ✅ تغطية شاملة
- 92 framework
- أي npm package مع types
- أمثلة من GitHub

### ✅ مرونة
- Minimax اختياري للتحسين
- Chutes اختياري للأمثلة
- يعمل بدونهم تماماً

---

## 🔍 حل المشاكل

### المشكلة: "Connection closed"
**الحل:**
```bash
# تأكد من تشغيل السيرفر
npm run dev

# اختبر الاتصال يدوياً
curl http://localhost:3000/api/mcp
```

### المشكلة: "Port already in use"
**الحل:**
```bash
# سيستخدم 3001 تلقائياً
# أو غير الـ port في .env
PORT=3002
```

### المشكلة: "Module not found"
**الحل:**
```bash
npm install
npm run setup:local
```

---

## 📁 الملفات المعدلة

- `src/cache/file-cache.ts` - كاش محلي
- `src/providers/minimax-client.ts` - تكامل Minimax
- `src/providers/chutes-client.ts` - تكامل Chutes
- `src/middleware/rate-limit.ts` - كاش محلي
- `src/middleware/usage-tracking.ts` - كاش محلي
- `src/middleware/auth.ts` - كل شيء مجاني
- `src/config/index.ts` - متغيرات جديدة
- `package.json` - إزالة Upstash
- `.env.example` - متغيرات جديدة
- `tsconfig.json` - إضافة node types
- `app/api/mcp/route.ts` - إعادة كتابة كاملة
- `cline_mcp_config.json` - تكوين Cline
- `README-CLINE.md` - دليل Cline

---

## 🚀 البدء الآن

```bash
# 1. تشغيل السيرفر
cd /Users/emad/augments-mcp-server
npm run dev

# 2. في Cline
@augments get_api_context query="useEffect cleanup" framework="react"

# 3. استمتع! 🎉
```

**السيرفر يعمل الآن وجاهز للاستخدام! 🚀**