# llmWikiRPG

llmWikiRPG 是一个面向跑团/互动叙事的桌面运行时知识库。它不是把资料整理成普通百科，而是把作品资料、玩家状态、当前场景、关系张力、文风规则和回合日志组织成可读写的 RPG Wiki，让玩家可以与系统实时对话并推动剧情。

当前分支已经硬切换为 RPG-only：不再支持 legacy `llm_wiki` / `default` 项目，也不提供自动迁移。打开项目时必须能验证为 `llmwikirpg`，否则会被拒绝。

## Runtime Wiki 目录

新项目只创建并使用这些 RPG 目录：

- `wiki/sources/`
- `wiki/world/`
- `wiki/characters/`
- `wiki/player/`
- `wiki/locations/`
- `wiki/factions/`
- `wiki/items/`
- `wiki/plot-arcs/`
- `wiki/events/`
- `wiki/current-scene/`
- `wiki/relationships/`
- `wiki/style/`
- `wiki/rules/`
- `wiki/quests/`
- `wiki/memory/`

旧 llm_wiki 目录 `wiki/entities/`、`wiki/concepts/`、`wiki/queries/`、`wiki/comparisons/`、`wiki/synthesis/`、`wiki/methodology/`、`wiki/findings/`、`wiki/thesis/` 已不再是产品能力。应用不会自动删除用户磁盘上的旧文件，但 UI 不展示、不创建、不写入这些目录。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npx vitest run
```

Tauri 开发：

```bash
npm run tauri dev
```

## 项目标记

RPG 项目需要包含 `.llm-wiki/project.json`：

```json
{ "mode": "llmwikirpg" }
```

或在 schema 中包含：

```markdown
wikiMode: llmwikirpg
```

标记为 `default` 或缺少 RPG 标记的项目会被拒绝打开，不会自动迁移。
