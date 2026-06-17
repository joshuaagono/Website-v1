import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { Users } from './src/collections/Users'
import { Media } from './src/collections/Media'
import { Sermons } from './src/collections/Sermons'
import { Events } from './src/collections/Events'
import { Pages } from './src/collections/Pages'
import { Giving } from './src/collections/Giving'
import { SiteSettings } from './src/globals/SiteSettings'
import { LiveStream } from './src/globals/LiveStream'

export default buildConfig({
  admin: {
    user: 'users',
    meta: {
      titleSuffix: '— GraceStream Admin',
    },
  },
  collections: [Users, Media, Sermons, Events, Pages, Giving],
  globals: [SiteSettings, LiveStream],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  plugins: [
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    }),
  ],
  secret: process.env.PAYLOAD_SECRET!,
  typescript: {
    outputFile: './src/types/payload.ts',
  },
})
