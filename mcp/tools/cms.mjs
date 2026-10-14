import { z } from 'zod';
import { connectToDatabase } from '../db.mjs';

const CONTENT_COLLECTIONS = {
    projects: 'cms_projects',
    experiences: 'cms_experiences',
    blog: 'cms_blog',
    quotes: 'cms_quotes',
    research: 'cms_research',
    photography: 'cms_photography',
    konami: 'cms_konami'
};

export function registerCmsTools(server) {
    // 1. Get CMS Content
    server.tool(
        'get_cms_content',
        'Retrieve website CMS content by category (projects, experiences, blog, quotes, research, photography)',
        {
            type: z.enum(['projects', 'experiences', 'blog', 'quotes', 'research', 'photography', 'konami']).describe('CMS section to fetch')
        },
        async ({ type }) => {
            const collectionName = CONTENT_COLLECTIONS[type];
            const db = await connectToDatabase();
            const doc = await db.collection(collectionName).findOne({ _id: 'current' });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(doc ? doc.data : [], null, 2)
                    }
                ]
            };
        }
    );

    // 2. Update CMS Content
    server.tool(
        'update_cms_content',
        'Update or overwrite a CMS section with new JSON content data',
        {
            type: z.enum(['projects', 'experiences', 'blog', 'quotes', 'research', 'photography', 'konami']).describe('CMS section to update'),
            data: z.any().describe('New JSON payload representing the content structure')
        },
        async ({ type, data }) => {
            const collectionName = CONTENT_COLLECTIONS[type];
            const db = await connectToDatabase();

            await db.collection(collectionName).updateOne(
                { _id: 'current' },
                { $set: { data, updatedAt: new Date() } },
                { upsert: true }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `CMS content for "${type}" successfully updated in database.`
                    }
                ]
            };
        }
    );
}
