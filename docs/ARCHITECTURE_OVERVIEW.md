# llm_wiki_chemical 架构总览

## 项目整体架构说明

该项目不是传统“前端调后端 HTTP 服务”的 Web 应用，而是一个 **Tauri 桌面应用**：

- 前端是 `Vite + React 19 + TypeScript + Zustand`，主要业务编排也在前端 `src/` 内完成。
- 后端是 `Tauri + Rust`，主要负责本地文件系统访问、PDF/Office 文本提取、本地搜索、向量库存取、文件监听、本地 API 服务等能力。
- LLM 调用主体在前端 TypeScript 中完成，统一通过 `src/lib/llm-client.ts` 走 HTTP 或 CLI provider。
- 项目的知识库本体是 **本地文件夹项目**，而不是数据库表。核心数据落在项目目录下的 `raw/`、`wiki/` 和 `.llm-wiki/` 中。

从职责上看，更接近：

- React 前端：应用编排层、状态层、LLM 工作流层
- Rust/Tauri：本地能力层
- 文件系统：知识库真实存储层

## 前端技术栈和主要目录

前端技术栈可从 [package.json](../package.json) 与 `src/` 结构确认：

- `react` / `react-dom`
- `vite`
- `typescript`
- `zustand`
- `@tauri-apps/api`
- `@react-sigma/core` / `graphology`
- `milkdown`
- `i18next`
- `tailwindcss`

主要前端目录：

- `src/main.tsx`
  React 启动入口。
- `src/App.tsx`
  应用主入口；负责自动打开项目、恢复队列、恢复设置、启动 watcher、加载文件树。
- `src/components/`
  UI 视图层。
- `src/components/sources/`
  资料导入、重扫、重新 ingest、删除资料。
- `src/components/layout/`
  主布局、知识树、活动面板等。
- `src/components/chat/`
  聊天问答与基于 wiki 的检索回答。
- `src/components/graph/`
  知识图谱展示与图谱研究入口。
- `src/components/project/`
  新建项目、模板选择。
- `src/lib/`
  绝大多数核心业务逻辑所在，包括 ingest、search、embedding、deep research、dedup、wiki graph、prompt 构造等。
- `src/stores/`
  Zustand 状态管理。
- `src/commands/`
  前端对 Tauri Rust command 的调用封装。
- `src/types/`
  前端类型定义。

## 后端技术栈和主要目录

后端技术栈可从 [src-tauri/Cargo.toml](../src-tauri/Cargo.toml) 与 `src-tauri/src/` 确认：

- `tauri`
- `serde` / `serde_json`
- `reqwest`
- `tiny_http`
- `pdfium-render`
- `zip`
- `calamine`
- `docx-rs`
- `office_oxide`
- `lancedb`
- `notify`
- `walkdir`

主要后端目录：

- `src-tauri/src/main.rs`
  Tauri 二进制入口。
- `src-tauri/src/lib.rs`
  Tauri 应用装配入口；注册所有 commands，启动 clip server 和本地 API server。
- `src-tauri/src/commands/project.rs`
  项目创建/打开逻辑。
- `src-tauri/src/commands/fs.rs`
  文件读写、目录遍历、PDF/Office 文本抽取、预处理缓存。
- `src-tauri/src/commands/search.rs`
  本地搜索与混合检索后端。
- `src-tauri/src/commands/vectorstore.rs`
  LanceDB 向量库存取。
- `src-tauri/src/commands/file_sync.rs`
  文件监听、变更队列、rescan。
- `src-tauri/src/api_server.rs`
  本地 HTTP API，默认 `127.0.0.1:19828`。
- `src-tauri/src/clip_server.rs`
  Web clipper/剪藏配套本地服务。

## 数据存储方式

### 1. 项目主数据：文件系统

项目创建逻辑在 [src-tauri/src/commands/project.rs](../src-tauri/src/commands/project.rs) 中，默认目录结构为：

- `schema.md`
- `purpose.md`
- `raw/sources/`
- `raw/assets/`
- `wiki/entities/`
- `wiki/concepts/`
- `wiki/sources/`
- `wiki/queries/`
- `wiki/comparisons/`
- `wiki/synthesis/`
- `wiki/index.md`
- `wiki/log.md`
- `wiki/overview.md`

其中：

- `raw/sources/` 是原始资料区
- `wiki/` 是 LLM 生成并维护的知识页区

### 2. 项目内部状态：`.llm-wiki/`

多个模块会把项目级状态写入 `<project>/.llm-wiki/`：

- `.llm-wiki/ingest-queue.json`
  ingest 队列，见 `src/lib/ingest-queue.ts`
- `.llm-wiki/ingest-cache.json`
  内容哈希缓存，见 `src/lib/ingest-cache.ts`
- `.llm-wiki/review.json`
  review 项，见 `src/lib/persist.ts`
- `.llm-wiki/lint.json`
  lint 项，见 `src/lib/persist.ts`
- `.llm-wiki/conversations.json`
  聊天会话列表，见 `src/lib/persist.ts`
- `.llm-wiki/chats/*.json`
  会话消息
- `.llm-wiki/lancedb/`
  向量库，见 `src-tauri/src/commands/vectorstore.rs`
- `.llm-wiki/file-snapshot.json`
  watcher 快照，见 `src-tauri/src/commands/file_sync.rs`
- `.llm-wiki/file-change-queue.json`
  文件变更队列，见 `src-tauri/src/commands/file_sync.rs`
- `.llm-wiki/scheduled-import-db.json`
  定时导入状态，见 `src/lib/scheduled-import.ts`
- `.llm-wiki/page-history/`
  re-ingest merge 失败时的页面备份，见 `src/lib/ingest.ts`

### 3. 原始文件预处理缓存：`raw/sources/.cache/`

`src-tauri/src/commands/fs.rs` 会为 PDF/Office 等文件写预处理文本缓存：

- `raw/sources/.cache/<filename>.txt`

### 4. 应用级全局设置：Tauri Store

全局设置经 `@tauri-apps/plugin-store` 持久化到 `app-state.json`，封装在 [src/lib/project-store.ts](../src/lib/project-store.ts)。

保存内容包括：

- 最近项目
- 上次打开项目
- LLM 配置
- 搜索配置
- embedding 配置
- multimodal 配置
- source watch 配置
- API server 配置

### 5. 数据库结论

当前项目 **没有使用传统关系型数据库作为主存储**。主存储是文件系统；“数据库感”最强的部分只有：

- LanceDB：向量索引
- Tauri Store：应用设置 KV 存储

## LLM 调用位置

主要 LLM 调用入口：

- `src/lib/llm-client.ts`
  统一流式聊天/生成入口 `streamChat()`
- `src/lib/llm-providers.ts`
  各 provider 的请求体/解析配置
- `src/lib/ingest.ts`
  ingest 的分析与生成两阶段 prompt 都在这里触发
- `src/components/chat/chat-panel.tsx`
  普通问答 / wiki 检索回答
- `src/lib/deep-research.ts`
  外部检索与自动 ingest
- `src/lib/embedding.ts`
  embeddings 请求
- `src/lib/image-caption-pipeline.ts`
  图像 caption LLM 调用
- `src/lib/lint.ts`
  lint 流程
- `src/lib/sweep-reviews.ts`
  review 自动清扫
- `src/lib/dedup-runner.ts`
  去重合并流程

CLI provider 相关：

- `src/lib/claude-cli-transport.ts`
- `src/lib/codex-cli-transport.ts`
- `src-tauri/src/commands/claude_cli.rs`
- `src-tauri/src/commands/codex_cli.rs`

## 主要入口文件

### 桌面应用入口

- [src-tauri/src/main.rs](../src-tauri/src/main.rs)
  调用 `llm_wiki_lib::run()`
- [src-tauri/src/lib.rs](../src-tauri/src/lib.rs)
  Tauri 真正装配入口

### 前端入口

- [src/main.tsx](../src/main.tsx)
  React 渲染入口
- [src/App.tsx](../src/App.tsx)
  前端主应用入口

### 项目级业务入口

- `src/components/project/create-project-dialog.tsx`
  新建项目入口
- `src/components/sources/sources-view.tsx`
  手工导入/重扫/重新 ingest 的 UI 入口
- `src/lib/source-lifecycle.ts`
  导入文件、导入文件夹、删除 source 的主业务入口
- `src/lib/ingest-queue.ts`
  ingest 队列入口
- `src/lib/ingest.ts`
  知识抽取与 wiki 生成主入口

## 项目启动流程

从代码可确认的启动顺序如下：

1. `src-tauri/src/main.rs`
   启动 Tauri 二进制。
2. `src-tauri/src/lib.rs`
   注册 commands、启动 clip server、启动本地 API server、设置 pdfium 路径、载入代理配置。
3. `src/main.tsx`
   渲染 React `App`。
4. `src/App.tsx`
   执行前端初始化：
   - `setupAutoSave()`
   - `startClipWatcher()`
   - 读取 `app-state.json` 中的全局配置
   - 自动打开上次项目
5. 打开项目后，`handleProjectOpened()` 执行：
   - `resetProjectState()`
   - `restoreQueue()` 恢复 ingest 队列
   - 恢复 dedup queue
   - 读取 scheduled import / source watch 配置
   - 启动 `project-file-sync`
   - 读取文件树
   - 读取 review/lint/chat 持久化数据

## 重要文件路径清单

### 启动与装配

- `src/main.tsx`
- `src/App.tsx`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`

### 项目创建与模板

- `src/components/project/create-project-dialog.tsx`
- `src/components/project/template-picker.tsx`
- `src/lib/templates.ts`
- `src-tauri/src/commands/project.rs`

### Source 导入与文件生命周期

- `src/components/sources/sources-view.tsx`
- `src/lib/source-lifecycle.ts`
- `src/lib/project-file-sync.ts`
- `src/lib/scheduled-import.ts`
- `src/lib/clip-watcher.ts`
- `src-tauri/src/commands/file_sync.rs`
- `src-tauri/src/commands/fs.rs`

### LLM 抽取与 Wiki 生成

- `src/lib/ingest.ts`
- `src/lib/ingest-queue.ts`
- `src/lib/ingest-cache.ts`
- `src/lib/ingest-sanitize.ts`
- `src/lib/page-merge.ts`
- `src/lib/sources-merge.ts`

### 搜索、图谱、问答

- `src/lib/search.ts`
- `src-tauri/src/commands/search.rs`
- `src/components/chat/chat-panel.tsx`
- `src/lib/graph-relevance.ts`
- `src/lib/wiki-graph.ts`
- `src/components/graph/graph-view.tsx`

### 向量与多模态

- `src/lib/embedding.ts`
- `src/lib/text-chunker.ts`
- `src-tauri/src/commands/vectorstore.rs`
- `src/lib/extract-source-images.ts`
- `src/lib/image-caption-pipeline.ts`

### 本地 API / 外部集成

- `src-tauri/src/api_server.rs`
- `src-tauri/src/clip_server.rs`
- `extension/manifest.json`
- `extension/popup.js`

## 当前阶段观察到的结构性风险

- `autoIngest()` 读取的是根目录 `schema.md` / `purpose.md`，但旧的交互式 ingest 路径 `startIngest()` / `executeIngestWrites()` 读取的是 `wiki/schema.md` / `wiki/purpose.md`。这说明仓库中存在一套旧路径约定残留，未来改造时应优先统一。
- 当前业务核心更偏向“前端 orchestrator + Rust capability backend”，因此未来改造分类体系时，改动面不会集中在单一后端模块，而是会散落在 prompt、页面类型推断、知识树、图谱着色、前端标签文案、项目模板和目录初始化逻辑中。
