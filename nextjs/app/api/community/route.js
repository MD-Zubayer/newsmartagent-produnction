import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data', 'community.json');

async function readReports() {
  try {
    const content = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(dataPath), { recursive: true });
      await fs.writeFile(dataPath, JSON.stringify([]), 'utf-8');
      return [];
    }
    throw err;
  }
}

async function writeReports(reports) {
  await fs.writeFile(dataPath, JSON.stringify(reports, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const reports = await readReports();
    return NextResponse.json({ reports });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const reports = await readReports();
    const now = new Date();
    const id = `NSA-${now.getTime().toString().slice(-6)}`;
    const newReport = {
      id,
      category: body.category || 'Feedback',
      title: body.title?.trim() || 'Untitled',
      details: body.details?.trim() || '',
      status: 'Open',
      submittedBy: body.name?.trim() || 'Anonymous',
      email: body.email || '',
      submittedAt: now.toISOString().slice(0, 10),
      replies: [],
    };
    reports.unshift(newReport);
    await writeReports(reports);
    return NextResponse.json(newReport, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
