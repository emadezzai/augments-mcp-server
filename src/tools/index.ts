/**
 * Tools module exports
 */

// Discovery tools
export {
  listAvailableFrameworks,
  searchFrameworks,
  getFrameworkInfo,
  getRegistryStats,
  ListFrameworksInputSchema,
  SearchFrameworksInputSchema,
  GetFrameworkInfoInputSchema,
  type ListFrameworksInput,
  type SearchFrameworksInput,
  type GetFrameworkInfoInput,
} from './discovery';

// Documentation tools
export {
  getFrameworkDocs,
  getFrameworkExamples,
  searchDocumentation,
  GetFrameworkDocsInputSchema,
  GetFrameworkExamplesInputSchema,
  SearchDocumentationInputSchema,
  type GetFrameworkDocsInput,
  type GetFrameworkExamplesInput,
  type SearchDocumentationInput,
} from './documentation';

// Context tools
export {
  getFrameworkContext,
  analyzeCodeCompatibility,
  GetFrameworkContextInputSchema,
  AnalyzeCodeCompatibilityInputSchema,
  type GetFrameworkContextInput,
  type AnalyzeCodeCompatibilityInput,
} from './context';

// Cache management tools
export {
  checkFrameworkUpdates,
  refreshFrameworkCache,
  getCacheStats,
  CheckFrameworkUpdatesInputSchema,
  RefreshFrameworkCacheInputSchema,
  type CheckFrameworkUpdatesInput,
  type RefreshFrameworkCacheInput,
} from './cache-management';

// Codebase tools
export {
  semanticCodeSearch,
  formatSemanticSearchResponse,
  SemanticCodeSearchInputSchema,
  type SemanticCodeSearchInput,
  type SemanticCodeSearchOutput,
  analyzeCodebaseStructure,
  formatCodebaseStructureResponse,
  AnalyzeCodebaseStructureInputSchema,
  type AnalyzeCodebaseStructureInput,
  type AnalyzeCodebaseStructureOutput,
  getFileContext,
  formatFileContextResponse,
  GetFileContextInputSchema,
  type GetFileContextInput,
  type GetFileContextOutput,
  findRelatedFiles,
  formatFindRelatedFilesResponse,
  FindRelatedFilesInputSchema,
  type FindRelatedFilesInput,
  type FindRelatedFilesOutput,
  extractModuleApi,
  formatExtractModuleApiResponse,
  ExtractModuleApiInputSchema,
  type ExtractModuleApiInput,
  type ExtractModuleApiOutput,
  detectArchitecturePattern,
  formatDetectArchitecturePatternResponse,
  DetectArchitecturePatternInputSchema,
  type DetectArchitecturePatternInput,
  type DetectArchitecturePatternOutput,
  analyzeImportGraph,
  formatAnalyzeImportGraphResponse,
  AnalyzeImportGraphInputSchema,
  type AnalyzeImportGraphInput,
  type AnalyzeImportGraphOutput,
  findPatternUsage,
  formatPatternUsageResponse,
  FindPatternUsageInputSchema,
  type FindPatternUsageInput,
  type FindPatternUsageOutput,
} from './codebase';
