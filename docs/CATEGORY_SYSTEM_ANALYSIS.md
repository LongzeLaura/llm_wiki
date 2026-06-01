# 默认分类系统分析

## 当前项目中有哪些默认分类

从项目创建模板、prompt、页面类型推断、知识树和图谱显示逻辑综合看，当前默认分类主要包括：

- `entity`
- `concept`
- `source`
- `query`
- `comparison`
- `synthesis`
- `overview`

扩展但已进入运行时代码的类型还包括：

- `finding`
- `thesis`
- `methodology`

来源：

- `src/lib/templates.ts`
- `src-tauri/src/commands/project.rs`
- `src/lib/wiki-page-types.ts`
- `src/lib/ingest.ts`
- `src/lib/wiki-type-style.ts`
- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`

## 这些分类在哪里定义

### 1. 项目模板/初始 schema

[src/lib/templates.ts](../src/lib/templates.ts) 中的：

- `BASE_SCHEMA_TYPES`
- `BASE_FRONTMATTER`
- 各 template 的 `schema`

这里定义了默认 page types、默认目录与默认 frontmatter 期望。

### 2. Rust 新建项目逻辑

[src-tauri/src/commands/project.rs](../src-tauri/src/commands/project.rs) 中定义默认目录：

- `wiki/entities`
- `wiki/concepts`
- `wiki/sources`
- `wiki/queries`
- `wiki/comparisons`
- `wiki/synthesis`

并生成默认 `schema.md` / `wiki/index.md`。

### 3. 运行时已知类型集合

[src/lib/wiki-page-types.ts](../src/lib/wiki-page-types.ts)：

- `GENERATION_WIKI_TYPES`
- `WIKI_TYPE_DIRS`
- `inferWikiTypeFromPath()`

这里决定：

- 哪些类型会出现在生成 prompt 的“known types”中
- 哪些目录会被自动识别成何种 type

## 这些分类在哪里被 prompt 使用

### 1. 分析阶段 prompt

[src/lib/ingest.ts](../src/lib/ingest.ts) 的 `buildAnalysisPrompt()` 明确硬编码：

- `## Key Entities`
- `## Key Concepts`

这意味着 Stage 1 仍然以 `entity/concept` 作为主要知识抽取心智模型。

### 2. 生成阶段 prompt

同文件 `buildGenerationPrompt()` 中明确写了：

- 生成 source summary page
- 生成 entity pages
- 生成 concept pages
- 更新 `wiki/index.md`
- 更新 `wiki/log.md`
- 更新 `wiki/overview.md`

同时又加入了一个重要扩展点：

- “Prefer schema-defined directories when present; otherwise use wiki/entities/ or wiki/concepts/”

这说明作者已经开始把类型系统从纯硬编码，过渡到“schema 优先、默认目录兜底”。

### 3. 项目模板 prompt

`src/lib/templates.ts` 中的 schema 文本也会写回 `schema.md`，从而影响 ingest prompt。

## 这些分类在哪里被后端保存

这里的“后端保存”本质上是写回 Markdown 文件，而不是写数据库表。

### 1. 目录路由

默认目录路由在：

- `src-tauri/src/commands/project.rs`
- `src/lib/wiki-page-types.ts`

### 2. frontmatter type 字段

每个 wiki page 的 `type:` 字段被写入 markdown frontmatter，相关处理在：

- `src/lib/ingest.ts`
- `src/lib/page-merge.ts`
- `src/lib/ingest-sanitize.ts`

### 3. source 关联字段

与分类相关的辅助元数据字段包括：

- `sources`
- `related`
- `tags`

相关代码：

- `src/lib/sources-merge.ts`
- `src/lib/source-lifecycle.ts`
- `src/lib/wiki-page-delete.ts`

### 4. 向量层

LanceDB 不直接保存 page type 字段，而是按 `page_id`/chunk 维度存储：

- `src/lib/embedding.ts`
- `src-tauri/src/commands/vectorstore.rs`

因此 type 主要来自 markdown 文件本身，而不是向量库 schema。

## 这些分类在哪里被前端展示

### 1. 知识树

[src/components/layout/knowledge-tree.tsx](../src/components/layout/knowledge-tree.tsx)

- `TYPE_CONFIG`
- `parsePageInfo()`

这里对以下类型有明确图标/颜色/顺序：

- `overview`
- `entity`
- `concept`
- `source`
- `synthesis`
- `finding`
- `thesis`
- `methodology`
- `comparison`
- `query`

其他未知类型会 fallback 到通用展示。

### 2. frontmatter 面板

[src/components/editor/frontmatter-panel.tsx](../src/components/editor/frontmatter-panel.tsx)

- `getWikiTypeStyle(type)`

### 3. 通用类型样式

[src/lib/wiki-type-style.ts](../src/lib/wiki-type-style.ts)

- `WIKI_TYPE_STYLES`

这里硬编码了 `entity/concept/query/source/...` 的 chip 样式和 icon。

### 4. 图谱视图

[src/components/graph/graph-view.tsx](../src/components/graph/graph-view.tsx)

- `NODE_TYPE_COLORS`
- `nodeTypeLabels`

对常见类型有专门颜色映射，其余自定义类型会 fallback 到哈希颜色。

### 5. 页面类型推断

[src/lib/wiki-page-types.ts](../src/lib/wiki-page-types.ts)

- `inferWikiTypeFromPath()`
- `wikiTypeLabel()`

### 6. 聊天引用与活动面板

- `src/components/chat/chat-message.tsx`
- `src/components/layout/activity-panel.tsx`

也会根据类型显示不同 icon/标签。

## 这些分类是否是硬编码的

结论：**部分硬编码，部分已开始配置化。**

### 明显硬编码的部分

- `buildAnalysisPrompt()` 里的 `Key Entities` / `Key Concepts`
- `buildGenerationPrompt()` 里的 entity/concept/source 语义
- `src-tauri/src/commands/project.rs` 的默认目录
- `src/lib/wiki-page-types.ts` 的内置目录映射
- `src/lib/wiki-type-style.ts` 的样式映射
- `src/components/layout/knowledge-tree.tsx` 的 `TYPE_CONFIG`
- `src/components/graph/graph-view.tsx` 的 `NODE_TYPE_COLORS`

### 已开始配置化的部分

- `schema.md` 已被视为 ingest routing 的 authoritative source
- `buildGenerationPrompt()` 支持“schema-defined directories”
- `inferWikiTypeFromPath()` 支持 `wiki/<custom-dir>/foo.md` 返回自定义类型
- `wikiTypeLabel()` 对未知类型能自动生成 label
- 图谱颜色对未知类型有 fallback 哈希色

## 如果要替换为化工分类，会影响哪些位置

未来把通用分类替换为“催化系统、基元过程、激励网络、证据链”等化工分类时，最可能影响以下位置。

### A. 项目模板与初始化

- `src/lib/templates.ts`
- `src-tauri/src/commands/project.rs`
- `src/components/project/create-project-dialog.tsx`

原因：

- 新项目默认目录
- 默认 schema 文本
- 默认 index 分类标题

### B. ingest prompt 与抽取心智模型

- `src/lib/ingest.ts`

重点包括：

- `buildAnalysisPrompt()`
- `buildGenerationPrompt()`
- 可能还包括 review suggestion prompt

原因：

- 目前 Stage 1 明确要求识别 entities/concepts
- Stage 2 明确要求生成 entity/concept/source pages

### C. 页面类型推断与运行时类型表

- `src/lib/wiki-page-types.ts`

原因：

- 新类型若想成为“一等公民”，最好进入 `GENERATION_WIKI_TYPES`
- 若使用固定目录名，也应加入 `WIKI_TYPE_DIRS`

### D. 前端展示层

- `src/lib/wiki-type-style.ts`
- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/layout/activity-panel.tsx`

原因：

- 图标、颜色、排序、标签文案仍对旧类型有偏向

### E. 目录级清理/删除/解析逻辑

以下文件虽然不一定必须马上改，但需要复核是否假定了 `entities/concepts/sources`：

- `src/lib/source-lifecycle.ts`
- `src/lib/wiki-page-delete.ts`
- `src/lib/wiki-page-resolver.ts`
- `src/lib/wiki-graph.ts`

其中：

- `wiki-page-resolver.ts` 对 `wiki/sources/` 有明确路径约定
- `source-lifecycle.ts` 删除 source 时会扫描所有 markdown 的 `sources:` 字段
- `wiki-graph.ts` 默认隐藏 `query`，并基于 type 做图谱判断

### F. 搜索与问答呈现

- `src/components/chat/chat-panel.tsx`
- `src/lib/search.ts`
- `src-tauri/src/commands/search.rs`

这些模块不强依赖 `entity/concept`，但问答引用展示与页面解释可能仍受类型标签影响。

## 哪些地方适合改成配置化 category schema / category registry

这是未来最值得做的抽象层，但本轮不实现。

### 1. 建一个统一的 category registry

建议新增一个集中 registry，未来可由 `schema.md` 或单独配置文件派生，例如：

- `src/lib/category-registry.ts`

建议该 registry 统一提供：

- type id
- display label
- directory
- icon key
- color
- sort order
- analysis-stage semantic role
- generation-stage routing policy

### 2. 让以下模块统一读 registry

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`
- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/chat/chat-message.tsx`

### 3. 让 ingest prompt 从 registry/schema 生成

尤其是：

- `buildAnalysisPrompt()`
- `buildGenerationPrompt()`

这两处是从“通用知识”迁移到“化工知识抽取”最关键的地方。

### 4. 项目初始化目录由 registry/template 派生

- `src-tauri/src/commands/project.rs`
- `src/lib/templates.ts`

## 哪些地方暂时不应该改动

当前阶段以及后续“最小改动路径”的第一轮，不建议先动以下位置：

### 1. Rust 文件系统/向量库基础能力

- `src-tauri/src/commands/fs.rs`
- `src-tauri/src/commands/vectorstore.rs`
- `src-tauri/src/commands/search.rs`

原因：

- 这些模块主要提供通用基础设施
- 与化工分类耦合较弱
- 改这里收益低、风险高

### 2. ingest queue / file sync 机制

- `src/lib/ingest-queue.ts`
- `src/lib/project-file-sync.ts`
- `src-tauri/src/commands/file_sync.rs`

原因：

- 这些是调度层，不是分类语义层

### 3. source 删除与 sources 字段维护逻辑

- `src/lib/source-lifecycle.ts`
- `src/lib/sources-merge.ts`

原因：

- 这些逻辑围绕“来源可追溯性”工作，和领域分类不是同一层问题

### 4. embedding / text chunking

- `src/lib/embedding.ts`
- `src/lib/text-chunker.ts`

原因：

- 这些是通用检索技术栈
- 化工改造第一阶段无需先调整

## 最小改动路径建议

本轮不实现，只给建议。

### 路径目标

让项目先能够：

- 在不破坏现有导入/抽取/删除/搜索主链路的前提下
- 将默认 page taxonomy 从 `entity/concept/source/...` 逐步过渡到化工领域 taxonomy

### 推荐最小改动顺序

1. 先定义化工 category schema，但只作为 `schema.md` 模板内容替换，不先改底层逻辑。
2. 让 `buildGenerationPrompt()` 更明确地“以 schema-defined folders 为主”，先弱化 entity/concept 话术。
3. 增加一个集中式 registry，让前端展示层支持化工类型的 label / icon / color / order。
4. 再改 `buildAnalysisPrompt()`，把 `Key Entities / Key Concepts` 改成更贴近化工语义的抽取框架。
5. 最后再考虑项目初始化默认目录是否从 `wiki/entities` / `wiki/concepts` 迁移到化工目录。

### 为什么这是最小路径

- 它先动 prompt/schema/展示层，后动底层目录与初始化层
- 能最大程度复用现有 ingest queue、文件监听、删除、embedding、搜索、图谱代码
- 可以先在单个新项目模板上试运行，而不必立刻全仓库强制迁移

## 对 `resource` 的结论

经当前代码检索：

- **未确认 `resource` 是运行时代码中的正式 page type**
- 未发现 `wiki/resources/`、`type: resource`、`resource` 类型样式与目录推断主流程

因此当前真实默认分类更接近：

- `entity`
- `concept`
- `source`
- `query`
- `comparison`
- `synthesis`
- `overview`

而不是“concept/entity/source/resource”四分类完整落地。

## 下一阶段推荐任务

1. 先做一轮“化工分类草案设计”，输出一个候选 `category registry` 文档，不改代码，只定义类型、目录、字段、展示名、关系约束。
2. 基于现有 `src/lib/templates.ts`，设计一个新的 `chemical` 项目模板，先只改模板文本和目录草案，不动 ingest 逻辑。
3. 专项核查 `startIngest()` / `executeIngestWrites()` 的遗留路径问题，确认是否保留、废弃还是统一到自动 ingest 流程。
4. 设计 `schema.md` 到运行时 registry 的映射策略，决定未来是“schema 驱动”还是“代码 registry 驱动，schema 只是导出物”。
5. 选取一篇真实化工 Markdown 文献做静态演练，人工推导它按当前系统会生成哪些 page types，从而找出最先需要改的 prompt 段落。
