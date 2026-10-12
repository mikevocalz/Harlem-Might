import { fetch } from 'react-native-nitro-fetch';
import type { ContentFetch } from './rest-source.ts';

export const contentFetch: ContentFetch = (url, init) => fetch(url, init);
