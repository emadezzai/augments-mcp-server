/**
 * Codebase Tools Module
 *
 * Tools for analyzing and searching large codebases (50k+ lines)
 */

// Semantic Code Search
export {
  semanticCodeSearch,
  formatSemanticSearchResponse,
  SemanticCodeSearchInputSchema,
  type SemanticCodeSearchInput,
  type SemanticCodeSearchOutput,
} from './semantic-code-search';

// Codebase Structure Analysis
export {
  analyzeCodebaseStructure,
  formatCodebaseStructureResponse,
  AnalyzeCodebaseStructureInputSchema,
  type AnalyzeCodebaseStructureInput,
  type AnalyzeCodebaseStructureOutput,
  type DirectoryNode,
  type ConfigFile,
  type EntryPoint,
} from './analyze-codebase-structure';

// File Context Analysis
export {
  getFileContext,
  formatFileContextResponse,
  GetFileContextInputSchema,
  type GetFileContextInput,
  type GetFileContextOutput,
  type FunctionInfo,
  type ClassInfo,
  type ExportInfo,
  type ImportInfo,
} from './get-file-context';

// Find Related Files
export {
  findRelatedFiles,
  formatFindRelatedFilesResponse,
  FindRelatedFilesInputSchema,
  type FindRelatedFilesInput,
  type FindRelatedFilesOutput,
  type RelatedFile,
} from './find-related-files';

// Extract Module API
export {
  extractModuleApi,
  formatExtractModuleApiResponse,
  ExtractModuleApiInputSchema,
  type ExtractModuleApiInput,
  type ExtractModuleApiOutput,
  type ModuleExportInfo,
  type ModuleExportMember,
  type TypeInfo,
  type InterfaceInfo,
  type InterfaceProperty,
  type InterfaceMethod,
} from './extract-module-api';

// Detect Architecture Pattern
export {
  detectArchitecturePattern,
  formatDetectArchitecturePatternResponse,
  DetectArchitecturePatternInputSchema,
  type DetectArchitecturePatternInput,
  type DetectArchitecturePatternOutput,
  type ArchitecturePattern,
  type DirectoryStructure,
  type PatternEvidence,
} from './detect-architecture-pattern';

// Analyze Import Graph
export {
  analyzeImportGraph,
  formatAnalyzeImportGraphResponse,
  AnalyzeImportGraphInputSchema,
  type AnalyzeImportGraphInput,
  type AnalyzeImportGraphOutput,
  type ImportRelationship,
  type DependencyNode,
  type CircularDependency,
} from './analyze-import-graph';
