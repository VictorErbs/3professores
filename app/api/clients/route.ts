import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

async function readDb() {
  try {
    const raw = await fs.promises.readFile(DB_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    return { clients: {} }
  }
}

async function writeDb(db: any) {
  await fs.promises.mkdir(path.dirname(DB_PATH), { recursive: true })
  await fs.promises.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8')
}

export async function POST(req: Request) {
  const body = await req.json()
  const db = await readDb()
  const id = Date.now().toString()
  db.clients[id] = body
  await writeDb(db)
  return NextResponse.json({ id })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const db = await readDb()
  if (id) {
    return NextResponse.json(db.clients[id] || null)
  }
  // list all
  return NextResponse.json(
    Object.entries(db.clients).map(([id, v]) => ({ id, ...(v as any) }))
  )
}
