# llm_wiki_chemical

## 项目简介

`llm_wiki_chemical` 是基于原始 `llm_wiki` 改造的化工知识库构建工具，面向催化/化工文献与 Markdown 资料的结构化抽取与知识组织。它继承了原项目“本地文件即知识库”的 wiki 模式与两阶段 LLM 抽取流程，但将核心分类体系转向化工/催化领域的四层语义结构。

## 与原始 llm_wiki 的关系

- 保留：原始项目的本地文件型知识库结构、wiki 生成与维护机制、两阶段 ingest 解析与落盘方式。
- 新增：化工领域分类体系、化工模式的 prompt 适配、化工目录识别与前端展示、化工语义字段约束与验证工具。
- 兼容：原有 `entity` / `concept` / `source` 仍保留，化工分类以配置与注册表方式增量引入。

## 核心目标

本项目的目标不是简单抽取“实体/概念”，而是面向催化研究中的关键认知层次组织知识：

- **催化系统**：反应物、产物、中间体、催化剂、活性位点、孔道/笼/限域环境、反应条件等。
- **基元过程**：吸附/脱附、质子化/去质子化、成键/断键、扩散、迁移、失活与再生等。
- **机理网络**：基元过程之间的路径、分支、竞争关系、速控步骤、循环机制等。
- **证据声明**：实验/计算证据与机理结论之间的支撑关系与证据强度。

以上命名与目录来自项目内的化工分类注册表与化工本体文档。

## 化工知识分类体系

当前运行时已识别以下化工核心分类与目录映射（用于化工模式或后续迁移）：

- `catalytic_system` → `wiki/catalytic-systems/`
- `elementary_process` → `wiki/elementary-processes/`
- `mechanistic_network` → `wiki/mechanistic-networks/`
- `evidence_claim` → `wiki/evidence-claims/`

同时仍保留原有兼容目录（默认仍可用）：

- `wiki/entities/`
- `wiki/concepts/`
- `wiki/sources/`
- `wiki/queries/`
- `wiki/comparisons/`
- `wiki/synthesis/`
- `wiki/findings/`
- `wiki/thesis/`
- `wiki/methodology/`
- `wiki/index.md` / `wiki/log.md` / `wiki/overview.md`

说明：化工目录是否实际存在取决于项目创建时选择的模式与模板，但运行时已支持识别与渲染这些化工目录。

## 项目结构

以下为当前仓库的主要目录结构（省略构建产物与依赖）：

```
.
├─ docs/                      # 架构、流水线、化工本体与阶段性说明
├─ src/                       # 前端与核心业务逻辑（LLM 调用、ingest、搜索、图谱）
├─ src-tauri/                 # Rust/Tauri 本地能力与命令
├─ extension/                 # 浏览器剪藏扩展
├─ scripts/                   # 校验与辅助脚本
├─ tests/                     # 测试夹具与基准
├─ assets/                    # 项目静态资源
├─ plans/                     # 规划文档
├─ README.md                  # 本文档
└─ AGENTS.md / IMPLEMENTATION_LOG.md
```

## 工作流程

从导入文献到生成化工 wiki 的主流程为：

1. 导入化工文献或 Markdown 资料到 `raw/sources/`。
2. LLM 按两阶段 ingest 流程进行分析与生成。
3. 生成结果落盘到对应的 wiki 分类目录（化工或兼容分类）。
4. 系统更新 `index.md` / `overview.md` / `log.md` 等索引与概览。
5. 用户可通过知识树、图谱与检索进行跨文献综合与追溯。

## 安装与运行

以下命令来自当前仓库的默认构建流程：

```bash
# 需要 Node.js 与 Rust/Tauri 工具链
npm install
npm run tauri dev
```

Windows 注意：PowerShell 直接执行 `npm` 可能受执行策略限制，可改用：

```bash
cmd /c npm install
cmd /c npm run tauri dev
```

如需生产构建：

```bash
npm run tauri build
```

若你的环境与上述命令不一致，请根据实际工具链与权限调整。

## 使用示例（化工场景）

1. 导入若干篇沸石催化相关论文（PDF 或 Markdown）。
2. 系统抽取催化系统、基元过程、机理网络、证据声明，并写入对应分类目录。
3. 在知识树中查看某一机理网络条目，并追溯其引用的证据声明与来源页面。

以上示例为概念性流程描述，具体 UI 能力以当前版本实现为准。

## 当前状态与限制

- 项目已完成化工分类注册表与 prompt 适配，运行时可识别化工目录与类型。
- 默认行为仍以兼容原始 `llm_wiki` 分类为基线，化工模式通过项目配置与模板启用。
- Rust 端项目初始化仍偏向 legacy 目录结构，化工模式由前端模板覆盖。
- 化工语义字段已引入最小合同与校验脚本，但抽取质量仍依赖输入文献与 prompt 质量。
- 现阶段仍需要人工校对与持续评估。

## 后续开发方向

- 进一步优化化工 schema 与 prompt 质量。
- 强化化工四层分类的跨文献合并与一致性。
- 增强化工证据声明的结构化字段与校验覆盖。
- 补齐与化工模式相关的 UI 细节与评审流程。

## 致谢 / 来源

本项目基于原始 `llm_wiki` 思路与实现改造，遵循原项目的许可与归属约定。感谢原项目作者与社区的贡献。
2. Go to **Settings** → Configure your LLM provider (API key + model)
3. Optional: configure **Web Search** providers and source folder auto-watch in Settings
4. Go to **Sources** → Import documents (PDF, DOCX, MD, etc.)
5. Watch the **Activity Panel** — LLM automatically builds wiki pages
6. Use **Chat** to query your knowledge base
7. Browse the **Knowledge Graph** to see connections
8. Check **Review** for items needing your attention
9. Run **Lint** periodically to maintain wiki health

## Local HTTP API + AI Agent Skill

LLM Wiki ships a built-in local HTTP API at `http://127.0.0.1:19828` (token-protected, `127.0.0.1`-only) so external tools — including AI agents like **Claude Code**, **Codex**, or any HTTP-capable script — can query your wiki:

- `GET /api/v1/health` — server status (no auth)
- `GET /api/v1/projects` — list projects
- `GET /api/v1/projects/{id}/files` / `files/content` — read files and content
- `POST /api/v1/projects/{id}/search` — **hybrid** retrieval (keyword + vector) returning `mode`, `tokenHits`, `vectorHits`, per-result `vectorScore`
- `GET /api/v1/projects/{id}/graph` — wikilinks graph
- `POST /api/v1/projects/{id}/sources/rescan` — trigger a backend rescan

Enable + generate a token in **Settings → API Server**.

### Plug your AI agent in with one command

A ready-made **agent skill** for LLM Wiki lives in its own repo. Install it into Claude Code / Codex / any skills-compatible runtime:

```bash
npx skills add https://github.com/nashsu/llm_wiki_skill.git --skill llm_wiki_skill
```

After install, the agent can answer prompts like "what does my LLM Wiki say about X", "search my 知识库 for Y", "show the neighborhood of node Z in my wiki graph", and "rescan my wiki sources" by talking to your locally-running app — read-only by default, citing wiki page paths so you can verify in-app.

- **Skill repo**: <https://github.com/nashsu/llm_wiki_skill>
- **Trigger discipline**: it intentionally does **not** trigger on generic "search my notes" / "check my Obsidian / Notion / Logseq" — only when you explicitly name LLM Wiki / `my wiki` / `知识库`.

## Project Structure

```
my-wiki/
├── purpose.md              # Goals, key questions, research scope
├── schema.md               # Wiki structure rules, page types
├── raw/
│   ├── sources/            # Uploaded documents (immutable)
│   └── assets/             # Local images
├── wiki/
│   ├── index.md            # Content catalog
│   ├── log.md              # Operation history
│   ├── overview.md         # Global summary (auto-updated)
│   ├── entities/           # People, organizations, products
│   ├── concepts/           # Theories, methods, techniques
│   ├── sources/            # Source summaries
│   ├── queries/            # Saved chat answers + research
│   ├── synthesis/          # Cross-source analysis
│   └── comparisons/        # Side-by-side comparisons
├── .obsidian/              # Obsidian vault config (auto-generated)
└── .llm-wiki/              # App config, chat history, review items
```

## Star History

<a href="https://www.star-history.com/?repos=nashsu%2Fllm_wiki&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=nashsu/llm_wiki&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=nashsu/llm_wiki&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=nashsu/llm_wiki&type=date&legend=top-left" />
 </picture>
</a>

## License

This project is licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE) for details.
