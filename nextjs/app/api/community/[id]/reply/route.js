import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data', 'community.json');

async function readReports() {
  try {
    const content = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeReports(reports) {
  await fs.writeFile(dataPath, JSON.stringify(reports, null, 2), 'utf-8');
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const reports = await readReports();
    const idx = reports.findIndex((r) => r.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const reply = {
      by: 'NSA Team',
      at: new Date().toISOString().slice(0, 10),
      text: (body.text || '').trim(),
    };
    reports[idx].replies = [...(reports[idx].replies || []), reply];
    if (reports[idx].status === 'Open') reports[idx].status = 'In Review';

    await writeReports(reports);
    return NextResponse.json(reports[idx], { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to reply' }, { status: 500 });
  }
}
