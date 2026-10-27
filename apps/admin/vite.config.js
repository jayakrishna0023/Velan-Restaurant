import { defineConfig } from 'vite';
import { velanApp } from '@velan/shared/vite';

export default defineConfig(velanApp({ base: '/admin/', port: 5174 }));
