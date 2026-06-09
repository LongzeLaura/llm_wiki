export const RPG_WIKI_UPDATE_FENCE = "rpg-wiki-update"

export function createRpgWikiUpdateBlockPattern(): RegExp {
  return new RegExp(`\`\`\`${RPG_WIKI_UPDATE_FENCE}\\s*\\n([\\s\\S]*?)\`\`\``, "g")
}
