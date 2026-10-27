import { defineConfig } from 'vite';
import { velanApp } from '@velan/shared/vite';

export default defineConfig(velanApp({ base: '/delivery/', port: 5175 }));
