#!/usr/bin/env node
// Fails if any package resolved in <dir>/package-lock.json was published within
// MAX_DEPENDENCY_AGE_DAYS. Run after `npm ci`.
/* global fetch */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

async function main () {
  const dir = process.argv[2] ?? '.'
  const MAX_AGE_DAYS = Number(process.env.MAX_DEPENDENCY_AGE_DAYS ?? 30)
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000

  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'))

  const resolved = new Map()
  for (const [path, pkg] of Object.entries(lock.packages ?? {})) {
    if (!path.startsWith('node_modules/') || !pkg.version) continue
    const name = path.replace(/^.*node_modules\//, '')
    if (!resolved.has(name)) resolved.set(name, new Set())
    resolved.get(name).add(pkg.version)
  }

  const failures = []
  for (const [name, versions] of resolved) {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
    if (!res.ok) {
      console.warn(`warn: could not fetch metadata for ${name} (${res.status}), skipping`)
      continue
    }
    const meta = await res.json()
    for (const version of versions) {
      const published = meta.time?.[version]
      if (published && new Date(published).getTime() > cutoff) {
        failures.push({ name, version, published })
      }
    }
  }

  if (failures.length > 0) {
    console.error(`${dir}: dependencies published within the last ${MAX_AGE_DAYS} days:`)
    for (const f of failures) console.error(`  ${f.name}@${f.version} - published ${f.published}`)
    process.exit(1)
  }

  console.log(`${dir}: all dependencies are older than ${MAX_AGE_DAYS} days.`)
}

main()
