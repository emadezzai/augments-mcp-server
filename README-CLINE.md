# Augments MCP Server - Cline Integration Guide

## ⚡ التشغيل السريع

### 1. تشغيل السيرفر المحلي
```bash
cd /Users/emad/augments-mcp-server
npm run dev
```

### 2. إعداد Cline

**الطريقة 1: ملف التكوين (موصى)**
```bash
# انسخ هذا الملف إلى Cline config
cat cline_mcp_config.json
```

**الطريقة 2: يدوياً في Cline**
1. افتح Cline Settings
2. اذهب إلى MCP Servers
3. أضف Server جديد:
   - **Name**: `augments`
   - **Command**: `npx -y mcp-remote http://localhost:3000/api/mcp`
   - **Transport**: `http`

### 3. اختبار الاتصال

في Cline، اكتب:
```
@augments get_api_context query="useEffect cleanup" framework="react"
```

---

## 📋 المتغيرات المطلوبة

### إعداد البيئة (.env)
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

## 🛠 الأوامر المتاحة في Cline

### 1. جلب API Context
```
@augments get_api_context query="useState" framework="react"
```

### 2. البحث عن APIs
```
@augments search_apis query="state management hook"
```

### 3. معلومات الـ Versions
```
@augments get_version_info framework="react" fromVersion="18" toVersion="19"
```

### 4. البحث عن Frameworks
```
@augments search_frameworks query="database"
```

### 5. جلب Documentation
```
@augments get_framework_docs framework="prisma"
```

---

## 🎯 مميزات 100% مجانية

✅ **Types من npm CDN** - لا يحتاج API keys
✅ **Kash محلي** - لا يحتاج Redis
✅ **Minimax اختياري** - للتحسين فقط
✅ **Chutes اختياري** - لأمثلة إضافية
✅ **GitHub مجاني** - 60 requests/hour (أو 5000 مع token)

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

---

## 🚀 التشغيل

```bash
# 1. إعداد البيئة
npm run setup:local

# 2. تشغيل السيرفر
npm run dev

# 3. في Cline
@augments get_api_context query="useEffect cleanup" framework="react"
```

---

## 🔍 اختبار الاتصال

```bash
# اختبار الـ Health Check
curl http://localhost:3000/api/mcp

# اختبار Initialize
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cline","version":"1.0"}},"id":1}'
```

---

## ⚠️ ملاحظات

1. **السيرفر يعمل على**: http://localhost:3000/api/mcp
2. **Cline يحتاج**: `mcp-remote` package (يتم تثبيته تلقائياً)
3. **Port 3000**: إذا كان مشغولاً، سيتم استخدام 3001 تلقائياً
4. **Minimax/Chutes**: اختياري - السيرفر يعمل بدونهم

---

## 📞 دعم

إذا واجهت مشاكل:
1. تأكد من تشغيل السيرفر: `npm run dev`
2. تحقق من المتغيرات في `.env`
3. اختبر الاتصال يدوياً بـ curl
4. تأكد من أن Cline يمكنه الوصول إلى localhost:3000

---

**السيرفر جاهز للاستخدام مع Cline! 🚀**