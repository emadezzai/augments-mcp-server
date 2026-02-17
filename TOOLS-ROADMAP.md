# أدوات MCP للمشاريع الكبيرة (50k+ سطر كود)

## ملخص المشروع

هذا الملف يحتوي على الأدوات المقترحة لإضافة إلى **Augments MCP Server** لتناسب المشاريع الكبيرة.

---

## الأدوات حسب الأولوية

### 🔴 الأولوية القصوى

#### 1. semantic_code_search
**الوصف:** بحث ذكي في الكود يفهم المعنى وليس فقط النصوص
```typescript
// المدخلات
{
  query: string,           // "كيف يتم التعامل مع المدفوعات"
  filePattern?: string,    // "*.ts"
  maxResults?: number
}

// المخرجات
{
  results: Array<{
    file: string,
    line: number,
    snippet: string,
    relevance: number
  }>
}
```

#### 2. analyze_codebase_structure
**الوصف:** تحليل بنية المشروع الكاملة
```typescript
// المدخلات
{
  rootPath?: string,
  includeHidden?: boolean
}

// المخرجات
{
  totalFiles: number,
  totalLines: number,
  languageBreakdown: Record<string, number>,
  directoryTree: DirectoryNode[],
  entryPoints: string[],
  configFiles: ConfigFile[]
}
```

#### 3. get_file_context
**الوصف:** الحصول على سياق الملف المطلوب
```typescript
// المدخلات
{
  filePath: string,
  focusFunction?: string,  // دالة محددة
  focusLine?: number,      // سطر محدد
  contextLines?: number    // عدد أسطر السياق (افتراضي 50)
}

// المخرجات
{
  file: string,
  imports: string[],
  exports: string[],
  functions: FunctionInfo[],
  classes: ClassInfo[],
  relatedFiles: string[],
  context: string          // الكود المحيط
}
```

#### 4. find_related_files
**الوصف:** العثور على الملفات المرتبطة بناءً على الاستيرادات والأنماط
```typescript
// المدخلات
{
  filePath: string,
  relationTypes?: Array<"imports" | "exports" | "inherits" | "calls" | "tests">
}

// المخرجات
{
  direct: RelatedFile[],
  indirect: RelatedFile[],  // ملفات مرتبطة بشكل غير مباشر
  dependencyDepth: number
}
```

#### 5. extract_module_api
**الوصف:** استخراج API العام لوحدة/مodule
```typescript
// المدخلات
{
  modulePath: string,       // مسار الوحدة
  includePrivate?: boolean  // تضمين الوظائف الخاصة
}

// المخرجات
{
  module: string,
  exports: ExportInfo[],
  types: TypeInfo[],
  interfaces: InterfaceInfo[],
  dependencies: string[]
}
```

---

### 🟡 الأولوية المتوسطة

#### 6. detect_architecture_pattern
**الوصف:** اكتشاف أنماط التصميم المستخدمة
```typescript
// المدخلات
{
  rootPath?: string
}

// المخرجات
{
  pattern: "MVC" | "Clean Architecture" | "DDD" | "Hexagonal" | "Microservices" | "Unknown",
  confidence: number,
  evidence: string[],
  suggestedStructure: DirectoryStructure[]
}
```

#### 7. find_pattern_usage
**الوصف:** البحث عن استخدام أنماط معينة
```typescript
// المدخلات
{
  pattern: string,          // "singleton" أو "observer" أو "factory"
  filePattern?: string
}

// المخرجات
{
  pattern: string,
  occurrences: Occurrence[],
  suggestions: string[]
}
```

#### 8. analyze_import_graph
**الوصف:** رسم خريطة للتبعيات
```typescript
// المدخلات
{
  rootPath?: string,
  depth?: number
}

// المخرجات
{
  nodes: DependencyNode[],
  edges: DependencyEdge[],
  circularDeps: string[][],
  stats: { total: number, avgDepth: number }
}
```

#### 9. identify_public_interfaces
**الوصف:** تحديد الواجهات العامة والتصديرات
```typescript
// المدخلات
{
  packagePath: string
}

// المخرجات
{
  publicExports: ExportInfo[],
  internalExports: ExportInfo[],
  typeExports: TypeInfo[]
}
```

#### 10. generate_code_summary
**الوصف:** ملخص للكود في ملف أو مجلد
```typescript
// المدخلات
{
  path: string,
  maxLength?: number
}

// المخرجات
{
  summary: string,
  keyFunctions: string[],
  keyClasses: string[],
  mainPurpose: string
}
```

---

### 🟢 الأولوية المنخفضة

#### 11. find_circular_dependencies
**الوصف:** اكتشاف التبعيات الدائرية

#### 12. understand_component_tree
**الوصف:** فهم هيكل المكونات وعلاقاتها

#### 13. analyze_state_flow
**الوصف:** تتبع تدفق الحالة في التطبيق

#### 14. search_by_functionality
**الوصف:** البحث عن الوظائف بناءً على الوصف الطبيعي

#### 15. locate_test_files
**الوصف:** العثور على ملفات الاختبار المتعلقة

#### 16. analyze_change_impact
**الوصف:** تحليل تأثير التغيير على باقي المشروع

#### 17. connect_monorepo_tools
**الوصف:** التكامل مع Nx/Turborepo/Lerna

#### 18. analyze_workspace_deps
**الوصف:** تحليل تبعيات workspace

#### 19. map_microservices
**الوصف:** رسم خريطة microservices

---

## خطة التنفيذ

### المرحلة 1: أدوات التحليل الأساسية
- [ ] 1. analyze_codebase_structure
- [ ] 2. get_file_context
- [ ] 3. find_related_files

### المرحلة 2: أدوات البحث
- [x] 4. semantic_code_search ✅ (تم التنفيذ)
- [ ] 5. find_pattern_usage
- [ ] 6. search_by_functionality

### المرحلة 3: أدوات إدارة الكود
- [ ] 7. extract_module_api
- [ ] 8. identify_public_interfaces
- [ ] 9. generate_code_summary
- [ ] 10. analyze_change_impact

### المرحلة 4: أدوات متقدمة
- [ ] 11. detect_architecture_pattern
- [ ] 12. analyze_import_graph
- [ ] 13. find_circular_dependencies
- [ ] 14. understand_component_tree
- [ ] 15. analyze_state_flow

### المرحلة 5: أدوات التكامل
- [ ] 16. connect_monorepo_tools
- [ ] 17. analyze_workspace_deps
- [ ] 18. map_microservices
- [ ] 19. locate_test_files

---

## ملاحظات التنفيذ

1. **البداية بـ analyze_codebase_structure** - تعطي فهماً سريعاً لبنية المشروع
2. **semantic_code_search** - الأكثر فائدة للمطورين في المشاريع الكبيرة
3. **get_file_context** - ضرورية لفهم الكود بسرعة
4. يمكن تنفيذ كل أداة بشكل مستقل
5. الأدوات يمكن أن تتشارك بعض الوظائف المساعدة (helpers)

---

## أمثلة على الاستخدام

### مثال 1: فهم ملف جديد
```
المستخدم: "محتاج أفهم ملف auth/service.ts"
→ get_file_context({ filePath: "auth/service.ts" })
→ يجد: الاستيرادات، التصديرات، الدوال، الملفات المرتبطة
```

### مثال 2: البحث عن نمط
```
المستخدم: "فين يتم استخدام singleton في المشروع؟"
→ find_pattern_usage({ pattern: "singleton" })
→ يجد: جميع الملفات التي تستخدم هذا النمط
```

### مثال 3: تحليل تأثير تغيير
```
المطور: "محتاج أغير function معينة"
→ analyze_change_impact({ functionName: "processPayment" })
→ يجد: جميع الملفات المتأثرة بهذا التغيير