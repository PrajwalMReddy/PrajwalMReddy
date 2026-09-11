// Shared utility functions for components

export const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

const IMAGE_EXTENSIONS = {
    'promptly': 'svg',
    'pulsar': 'png',
    'midilang': 'png',
    'kannadadisco': 'png',
    'research-paper': 'png',
    'firemedia': 'png',
    'jetblasters': 'png',
    'robocup-2023': 'png',
    'city-skyline': 'png',
    'critter-world': 'png',
    'conscript-generator': 'png',
    'niranjanux': 'png',
    'hurricane': 'png',
};

export const getImage = (imageName) => {
    if (!imageName) return null;
    if (typeof imageName === 'string') {
        if (imageName.startsWith('/') || imageName.startsWith('http') || imageName.startsWith('data:')) {
            return imageName;
        }
        const ext = IMAGE_EXTENSIONS[imageName] || (imageName.includes('.') ? '' : 'png');
        const filename = ext ? `${imageName}.${ext}` : imageName;
        return `/img/${filename}`;
    }
    return null;
};
