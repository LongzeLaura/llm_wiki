# Markdown/资料抽取流水线映射

## 流程总览

当前项目的“导入文献 -> LLM 抽取 -> 生成知识库”主流程，默认走的是 **自动 ingest 队列路径**，而不是旧的交互式聊天式 ingest。

主链路：

1. `src/components/sources/sources-view.tsx`
2. `src/lib/source-lifecycle.ts`
3. `src/lib/ingest-queue.ts`
4. `src/lib/ingest.ts`
5. `src/lib/embedding.ts`（可选）
6. `src/lib/wiki-graph.ts` / `src/components/layout/knowledge-tree.tsx`（展示）

补充入口：

- 定时导入：`src/lib/scheduled-import.ts`
- 文件监听自动 ingest：`src/lib/project-file-sync.ts` + `src-tauri/src/commands/file_sync.rs`
- 剪藏自动 ingest：`src/lib/clip-watcher.ts`
- Deep Research 结果自动 ingest：`src/lib/deep-research.ts`

## Markdown 文件导入流程

### 1. UI 入口

来源视图在 [src/components/sources/sources-view.tsx](../src/components/sources/sources-view.tsx)：

- `handleImport()`
  导入单个或多个文件
- `handleImportFolder()`
  导入整个目录
- `handleIngest()`
  对已存在 source 重新入队 ingest
- `handleRefreshSources()`
  触发 source watch/rescan

### 2. 复制到项目 raw/sources

[src/lib/source-lifecycle.ts](../src/lib/source-lifecycle.ts) 负责资料文件生命周期：

- `importSourceFiles()`
  把外部文件复制到 `<project>/raw/sources/`
- `importSourceFolder()`
  递归复制目录到 `<project>/raw/sources/<folderName>/`
- `enqueueSourceIngest()`
  生成 ingest 任务并送入队列

这个阶段会做：

- 扩展名白名单过滤 `INGESTABLE_SOURCE_EXTENSIONS`
- source watch 规则过滤
- 文件大小过滤
- 目标文件名冲突处理

### 3. 预处理

导入后会调用 `preprocessFile()`：

- 前端调用封装：`src/commands/fs.ts`
- Rust 实现：`src-tauri/src/commands/fs.rs`

行为：

- 对 `pdf/doc/docx/pptx/xls/xlsx/odt/ods/odp` 等做文本抽取
- 将结果写到 `raw/sources/.cache/<filename>.txt`
- 普通 Markdown / txt / json / yaml 等文本文件不需要特殊预处理

## 文本如何被切分或预处理

这里有两套不同的切分逻辑，分别用于 **ingest 分析** 和 **embedding**。

### A. ingest 分析阶段的长文档切分

位于 [src/lib/ingest.ts](../src/lib/ingest.ts)：

- `analyzeLongSourceInChunks()`
- `splitSourceIntoSemanticChunks()`
- `semanticBlocks()`
- `buildChunkAnalysisSystemPrompt()`
- `buildChunkAnalysisUserPrompt()`

用途：

- 当 source 很长时，不直接整篇送给 LLM
- 先按标题/段落/重叠上下文切成 semantic chunks
- 逐块分析
- 再汇总成 consolidated analysis

已确认特征：

- 使用 heading path
- 使用 overlap context
- 先分块分析，再合成全局 digest

### B. embedding 阶段的 markdown chunking

位于 [src/lib/text-chunker.ts](../src/lib/text-chunker.ts)：

- `chunkMarkdown()`

用途：

- 把 wiki 页切成适合 embedding 的块

已确认规则：

- 去掉 YAML frontmatter
- 按 section/paragraph/line/sentence/space 递归切分
- 不拆 fenced code block
- 不拆 markdown table
- 给 chunk 附带 `headingPath`
- 给相邻 chunk 加 overlap

### C. LLM 输出落盘前的清洗

位于 [src/lib/ingest-sanitize.ts](../src/lib/ingest-sanitize.ts)：

- `sanitizeIngestedFileContent()`

会修复：

- 整页被 ```yaml 包住
- 错误的 `frontmatter:` 前缀
- 缺失 opening `---`
- frontmatter 中非法的 wikilink 列表格式

## LLM 抽取 prompt 在哪里构造

### 自动 ingest 主 prompt

位于 [src/lib/ingest.ts](../src/lib/ingest.ts)：

- `buildAnalysisPrompt()`
  Stage 1：分析 prompt
- `buildGenerationPrompt()`
  Stage 2：生成 wiki FILE blocks prompt
- `buildReviewSuggestionPrompt()`
  可选 review suggestion 阶段

自动 ingest 调用位置：

- `autoIngest()`
- `autoIngestImpl()`

### 旧的交互式 ingest prompt

同样位于 `src/lib/ingest.ts`：

- `startIngest()`
- `executeIngestWrites()`

说明：

- 这条路径仍然存在，但 `SourcesView` 里的重新 ingest 已改为排队走 `enqueueSourceIngest()`，所以当前 source 导入默认主路径不是这条。
- 这条旧路径读取 `wiki/schema.md` / `wiki/purpose.md`，与自动 ingest 使用根目录 `schema.md` / `purpose.md` 不一致，属于后续需要重点核查的遗留分叉。

## LLM 抽取结果的数据格式

### Stage 1 结果

Stage 1 是自由文本分析结果，不直接结构化存储，主要作为 Stage 2 上下文输入。

内容要求由 `buildAnalysisPrompt()` 规定，包括：

- Key Entities
- Key Concepts
- Main Arguments & Findings
- Connections to Existing Wiki
- Contradictions & Tensions
- Recommendations

### Stage 2 结果

Stage 2 必须输出特殊块格式，定义在 `buildGenerationPrompt()` 与解析器 `parseFileBlocks()` 中：

```text
---FILE: wiki/path/to/page.md---
(complete markdown file content)
---END FILE---
```

可选 review block：

```text
---REVIEW: type | Title---
...
---END REVIEW---
```

解析函数：

- `parseFileBlocks()`
- `parseReviewBlocks()`

## 抽取结果如何保存

### 1. 写 Markdown 文件

位于 `src/lib/ingest.ts`：

- `writeFileBlocks()`

写入行为：

- `wiki/log.md` 追加写
- `wiki/index.md` / `wiki/overview.md` 覆盖写
- 其他内容页若已存在，则走 `mergePageContent()` 合并

相关文件：

- `src/lib/page-merge.ts`
- `src/lib/sources-merge.ts`

### 2. 兜底 source summary

如果 LLM 没生成 source summary，会在 `autoIngestImpl()` 中补写：

- `wiki/sources/<sourceSummarySlug>.md`

### 3. 保存 review items

`parseReviewBlocks()` 输出后写入 review store，并由 `src/lib/persist.ts` 持久化到：

- `.llm-wiki/review.json`

### 4. 保存 ingest cache

位于：

- `src/lib/ingest-cache.ts`

文件：

- `.llm-wiki/ingest-cache.json`

作用：

- 用 source 内容哈希跳过未变化的重新 ingest

### 5. 保存向量

若 embedding 开启：

- `src/lib/embedding.ts` 的 `embedPage()`
- `src-tauri/src/commands/vectorstore.rs`

向量落在：

- `.llm-wiki/lancedb/`

## Wiki 页面或知识条目如何生成

生成工作集中在 [src/lib/ingest.ts](../src/lib/ingest.ts)。

### 自动 ingest 的已确认步骤

1. 读取 source 内容、`schema.md`、`purpose.md`、`wiki/index.md`、`wiki/overview.md`
2. 检查 ingest cache
3. 可选执行图片提取与 caption 预处理
4. 对长文档进行分块分析，或直接执行 Stage 1 分析
5. 执行 Stage 2 生成 FILE blocks / REVIEW blocks
6. `writeFileBlocks()` 写回 wiki
7. 必要时补 source summary
8. 注入 `wiki/media/<source-slug>/` 图像引用
9. 解析 review blocks
10. 保存 ingest cache
11. 若 embedding 开启，调用 `embedPage()`
12. 文件树刷新，`dataVersion` 自增，图谱/知识树可见新页面

## 从“导入文献”到“生成知识库”的完整调用链

### 主链路：手工导入单篇/多篇资料

1. `src/components/sources/sources-view.tsx`
   `handleImport()`
2. `src/lib/source-lifecycle.ts`
   `importSourceFiles()`
3. `src/commands/fs.ts`
   `copyFile()` / `preprocessFile()`
4. `src-tauri/src/commands/fs.rs`
   实际复制与预处理
5. `src/lib/source-lifecycle.ts`
   `enqueueSourceIngest()`
6. `src/lib/ingest-queue.ts`
   `enqueueBatch()` -> `processNext()`
7. `src/lib/ingest.ts`
   `autoIngest()` -> `autoIngestImpl()`
8. `src/lib/llm-client.ts`
   `streamChat()` 调 Stage 1 / Stage 2
9. `src/lib/ingest.ts`
   `parseFileBlocks()` + `writeFileBlocks()`
10. 写入 `wiki/` 下的 source/entity/concept/... 页面
11. `src/lib/embedding.ts`
    `embedPage()`（如果开启）
12. `src/components/layout/knowledge-tree.tsx`
    与 `src/components/graph/graph-view.tsx` 通过刷新后的文件树和 `dataVersion` 呈现结果

### 主链路：重新 ingest 已有 source

1. `src/components/sources/sources-view.tsx`
   `handleIngest()`
2. `src/lib/source-lifecycle.ts`
   `enqueueSourceIngest()`
3. 后续与上面第 6 步起相同

### 辅助链路：文件监听自动 ingest

1. `src/App.tsx`
   打开项目后启动 `project-file-sync`
2. `src/lib/project-file-sync.ts`
   `startProjectFileSync()`
3. `src-tauri/src/commands/file_sync.rs`
   watcher / rescan 发现 `raw/sources/` 变更
4. `src/lib/project-file-sync.ts`
   `enqueueRawSourceChanges()`
5. `src/lib/source-lifecycle.ts`
   `enqueueSourceIngest()`
6. 后续进入同一 ingest 队列

### 辅助链路：定时导入

1. `src/lib/scheduled-import.ts`
   `scanAndImport()`
2. 拷贝外部目录文件到 `raw/sources/scheduled-import/...`
3. `enqueueSourceIngest()`
4. 后续进入同一 ingest 队列

## 每一步涉及的关键文件路径

### 导入与复制

- `src/components/sources/sources-view.tsx`
- `src/lib/source-lifecycle.ts`
- `src/commands/fs.ts`
- `src-tauri/src/commands/fs.rs`

### 队列与调度

- `src/lib/ingest-queue.ts`
- `src/lib/project-file-sync.ts`
- `src-tauri/src/commands/file_sync.rs`
- `src/lib/scheduled-import.ts`

### LLM 抽取

- `src/lib/ingest.ts`
- `src/lib/llm-client.ts`
- `src/lib/llm-providers.ts`

### 输出解析与落盘

- `src/lib/ingest.ts`
- `src/lib/ingest-sanitize.ts`
- `src/lib/page-merge.ts`
- `src/lib/sources-merge.ts`

### 图像/多模态

- `src/lib/extract-source-images.ts`
- `src/lib/image-caption-pipeline.ts`
- `src-tauri/src/commands/extract_images.rs`

### 向量与搜索

- `src/lib/embedding.ts`
- `src/lib/text-chunker.ts`
- `src-tauri/src/commands/vectorstore.rs`
- `src/lib/search.ts`
- `src-tauri/src/commands/search.rs`

## 未完全确认

- `resource` 并未在当前运行时代码中确认成正式 wiki page type。搜索结果显示它主要出现在文档语义描述或与浏览器扩展 manifest 的 `resources` 字段有关，未确认存在 `wiki/resources/` 目录或 `type: resource` 的主流程支持。
- 交互式旧 ingest 路径 `startIngest()` / `executeIngestWrites()` 目前是否仍被用户主流程主动使用，已确认不是 `SourcesView` 的默认路径，但是否仍被其他 UI 或历史功能入口引用，需要后续专项核查。
