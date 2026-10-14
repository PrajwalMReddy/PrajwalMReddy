const { requireAuth, isAuthenticated } = require('../../auth');
const { connectToDatabase } = require('../../db');

function getCollectionName(type) {
    switch (type) {
        case 'home':
            return 'cms_home';
        case 'about':
        case 'contact':
            return 'cms_about';
        case 'projects':
            return 'cms_projects';
        case 'experiences':
        case 'experience':
            return 'cms_experiences';
        case 'blog':
            return 'cms_blog';
        case 'quotes':
        case 'blog-quotes':
            return 'cms_quotes';
        case 'research':
            return 'cms_research';
        case 'photography':
            return 'cms_photography';
        case 'konami':
        case 'levels':
            return 'cms_konami';
        default:
            return null;
    }
}

module.exports = async (req, res) => {
    const { type } = req.query || {};

    if (req.method === 'GET') {
        if (!type) {
            return res.status(400).json({ error: 'Missing type query parameter' });
        }

        const collectionName = getCollectionName(type);
        if (!collectionName) {
            return res.status(400).json({ error: `Invalid content type: ${type}` });
        }

        const authed = isAuthenticated(req);

        // Fetch from MongoDB
        try {
            const db = await connectToDatabase();
            const doc = await db.collection(collectionName).findOne({ _id: 'current' });
            if (doc && doc.data !== undefined) {
                let result = doc.data;
                if (!authed && Array.isArray(result)) {
                    result = result.filter((item) => !item.visibility || item.visibility === 'public');
                }
                return res.status(200).json(result);
            }
        } catch (dbErr) {
            console.warn(`[CMS Content GET] MongoDB fetch error for ${type}:`, dbErr.message);
        }

        // Default fallback structure if not found or DB unreachable
        let fallback = [];
        if (type === 'projects' || type === 'experiences') {
            fallback = { sections: [], [type]: [] };
        } else if (type === 'home') {
            fallback = {
                title: { en: "Hello World!", kn: "ನಮಸ್ಕಾರ!" },
                intro: { en: "I'm [ˈprɐ.dʒʋəl ˈrɛ.ɖːi]", kn: "ನಾನು ಪ್ರಜ್ವಲ ರೆಡ್ಡಿ" },
                subtitle: { en: "a student, programmer, and builder.", kn: "ಕಲಿಗ, ಹಮ್ಮುಗ, ಮತ್ತು ಕಟ್ಟುಗ." },
                description: {
                    en: "I am a college student at Cornell University, studying a double major in Linguistics and Computer Science, with a specialization in Economics. I am also passionate about Urban Planning, often developing applications that focus on issues in these areas. My other non-academic interests include world building and conlanging.",
                    kn: "ನಾನು ಕೊರ್ನೆಲ ಮೇಲ್ಕಲಿಮನೆಯಲ್ಲಿ ಕಲಿಗರಾಗಿದ್ದೇನೆ. ನುಡಿಯರಿಮೆ, ಎಣಿಯರಿಮೆ, ಮತ್ತು ಸೊಮ್ಮರಿಮೆಯನ್ನು ಓದುತ್ತಿದ್ದೇನೆ. ಅಶ್ಟೇ ಅಲ್ಲ, ನಗರ ಹಮ್ಮುಗೆಯ ಮೇಲೆ ತುಂಬಾ ಇಶ್ಟಪಡುತೇನೆ. ನನ್ನ ಇತರ ಆಸಕ್ತಿಗಳಲ್ಲಿ ಪ್ರಪಂಚ ಕಟ್ಟುವಿಕೆ ಮತ್ತು ನುಡಿ ಕಟ್ಟುವಿಕೆ ಎರಡು."
                },
                skillsTitle: { en: "My Programming Skills", kn: "ನನ್ನ ಹಮ್ಮುಗಾರಿಕೆಯ ಕಲಿಕೆಗಳು" },
                skills: [
                    { id: "python", name: { en: "Python", kn: "ಪಾಯ್ತನ್" } },
                    { id: "javaKotlin", name: { en: "Java and Kotlin", kn: "ಜಾವ ಮತ್ತು ಕಾಟ್ಲಿನ್" } },
                    { id: "cpp", name: { en: "C and C++", kn: "ಸಿ ಮತ್ತು ಸಿ++" } },
                    { id: "dartFlutter", name: { en: "Dart + Flutter", kn: "ಡಾರ್ಟ್ + ಪ್ಲಟರ್" } },
                    { id: "php", name: { en: "PHP", kn: "ಪಿ.ಏಚ್.ಪಿ." } },
                    { id: "sql", name: { en: "SQL + MySQL", kn: "ಸೀಕ್ವಲ್ + ಮಯ್ಸೀಕ್ವಲ್" } },
                    { id: "web", name: { en: "HTML + CSS + JavaScript", kn: "ಏಚ್.ಟಿ.ಎಮ್.ಎಲ್. + ಸಿ.ಎಸ್.ಎಸ್. + ಜಾವಸ್ಕ್ರಿಪ್ಟ್" } },
                    { id: "rust", name: { en: "Rust", kn: "ರಸ್ಟ್" } },
                    { id: "arduino", name: { en: "Arduino", kn: "ಆರ್ಡ್ವೀನೊ" } }
                ]
            };
        } else if (type === 'about' || type === 'contact') {
            fallback = {
                heading: { en: "About Me", kn: "ನನ್ನ ಬಗ್ಗೆ" },
                homeHeading: { en: "Contact Me", kn: "ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಿ" },
                intro: { en: "", kn: "" },
                subheading: { en: "Find Me Here", kn: "ನಾನು ಇಲ್ಲಿ ಸಿಗಬಹುದು" },
                notice: {
                    en: "Feel free to reach out with any questions, thoughts, or just to say hello!",
                    kn: "ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳು, ಅನಿಸಿಕೆಗಳು, ಅಥವಾ ವಂದನೆಗಳು ಹೇಳಲು ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಲು ಹಿಂಜರಿಯಬೇಡಿ!"
                },
                links: [
                    {
                        id: "email",
                        label: { en: "Email: ", kn: "ಮಿನ್ನಂಚೆ: " },
                        text: { en: "prajwalmsreddy AT gmail DOT com", kn: "gmail ಚುಕ್ಕೆ com ಅಲ್ಲಿ prajwalmsreddy" },
                        url: "mailto:prajwalmsreddy@gmail.com",
                        isLink: false,
                        isInternal: false,
                        showOnHome: true
                    },
                    {
                        id: "github",
                        label: { en: "GitHub: ", kn: "ಗಿಟ್‌ಹಬ್: " },
                        text: { en: "github.com/PrajwalMReddy", kn: "github.com/PrajwalMReddy" },
                        url: "https://github.com/PrajwalMReddy",
                        isLink: true,
                        isInternal: false,
                        showOnHome: true
                    },
                    {
                        id: "linkedin",
                        label: { en: "LinkedIn: ", kn: "ಲಿಂಕ್ಡ್ಇನ್: " },
                        text: { en: "linkedin.com/in/prajwalmreddy", kn: "linkedin.com/in/prajwalmreddy" },
                        url: "https://www.linkedin.com/in/prajwalmreddy",
                        isLink: true,
                        isInternal: false,
                        showOnHome: true
                    },
                    {
                        id: "calendar",
                        label: { en: "Calendar: ", kn: "ಹೊತ್ತುಪಟ್ಟಿ: " },
                        text: { en: "book a short meeting with me...", kn: "ನನ್ನೊಂದಿಗೆ ಸಣ್ಣ ಸಭೆಯನ್ನು ಸೇರಿಸಲು..." },
                        url: "https://calendly.com/pmr93-cornell",
                        isLink: true,
                        isInternal: false,
                        showOnHome: false
                    },
                    {
                        id: "blog",
                        label: { en: "Blog: ", kn: "ಮಿಂಬರಹ: " },
                        text: { en: "read some of my thoughts here...", kn: "ನನ್ನ ಕೆಲವು ಯೋಚನೆಗಳನ್ನು ಇಲ್ಲಿ ಓದಿ..." },
                        url: "/blog",
                        isLink: true,
                        isInternal: true,
                        showOnHome: false
                    }
                ]
            };
        }
        return res.status(200).json(fallback);
    }

    if (req.method === 'POST') {
        if (!requireAuth(req, res)) return;

        const { type: bodyType, data } = req.body || {};
        const contentType = bodyType || type;

        if (!contentType || data === undefined) {
            return res.status(400).json({ error: 'contentType and data are required' });
        }

        const collectionName = getCollectionName(contentType);
        if (!collectionName) {
            return res.status(400).json({ error: `Invalid content type: ${contentType}` });
        }

        // Unify legacy { en, kn } photography data if received
        let payload = data;
        if (contentType === 'photography' && !Array.isArray(data) && data && (data.en || data.kn)) {
            const enList = data.en || [];
            const knList = data.kn || [];
            payload = enList.map((enItem, idx) => {
                const knItem = knList.find((k) => k.filename === enItem.filename) || knList[idx] || {};
                return {
                    id: enItem.id || (enItem.filename ? enItem.filename.replace(/\.[^/.]+$/, '') : `photo-${idx}`),
                    filename: enItem.filename || '',
                    title: { en: enItem.title || '', kn: knItem.title || '' },
                    date: { en: enItem.date || '', kn: knItem.date || '' },
                    location: {
                        place: {
                            en: enItem.location?.place || '',
                            kn: knItem.location?.place || '',
                        },
                        lat: enItem.location?.lat ?? knItem.location?.lat ?? null,
                        lng: enItem.location?.lng ?? knItem.location?.lng ?? null,
                    },
                };
            });
        }

        try {
            const db = await connectToDatabase();
            await db.collection(collectionName).updateOne(
                { _id: 'current' },
                { $set: { data: payload, updatedAt: new Date() } },
                { upsert: true }
            );

            return res.status(200).json({
                success: true,
                message: `${contentType} saved successfully`,
                storage: { database: true },
            });
        } catch (err) {
            console.error(`[CMS Content POST] MongoDB save error for ${contentType}:`, err.message);
            return res.status(500).json({ error: `Failed to save ${contentType} content to database: ${err.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
