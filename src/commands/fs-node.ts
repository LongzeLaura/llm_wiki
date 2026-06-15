import fs from "node:fs/promises"
import path from "node:path"
import type { FileNode } from "@/types/wiki"

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8")
}

export async function listDirectory(dirPath: string): Promise<FileNode[]> {
  return buildTree(dirPath)
}

async function buildTree(dirPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dirPath, entry.name).replace(/\\/g, "/")
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        is_dir: true,
        children: await buildTree(fullPath),
      })
    } else {
      nodes.push({
        name: entry.name,
        path: fullPath,
        is_dir: false,
        children: [],
      })
    }
  }

  return nodes
}
