// Shared utility functions for components
import pulsarImg from '@img/pulsar.png';
import midilangImg from '@img/midilang.png';
import kannadadiscoImg from '@img/kannadadisco.png';
import sentimentImg from '@img/research-paper.png';
import firemediaImg from '@img/firemedia.png';
import jetblastersImg from '@img/jetblasters.png';
import robocupImg from '@img/robocup-2023.png';
import northlandImg from '@img/city-skyline.png';

export const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }

    return result;
};

export const getImage = (imageName) => {
    const imageMap = {
        'pulsar': pulsarImg,
        'midilang': midilangImg,
        'kannadadisco': kannadadiscoImg,
        'research-paper': sentimentImg,
        'firemedia': firemediaImg,
        'jetblasters': jetblastersImg,
        'robocup-2023': robocupImg,
        'city-skyline': northlandImg
    };
    return imageMap[imageName] || null;
}; 