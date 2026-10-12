/** @jsxImportSource react */
import type { Metadata } from 'next';

import config from '@payload-config';
import { generatePageMetadata, RootPage } from '@payloadcms/next/views';
import { connection } from 'next/server';

import { importMap } from '../importMap.js';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export const instant = false;

export const generateMetadata = async ({ params, searchParams }: Args): Promise<Metadata> => {
  await connection();
  return generatePageMetadata({ config, params, searchParams });
};

export default async function Page({ params, searchParams }: Args) {
  await connection();
  return RootPage({ config, params, searchParams, importMap });
}
