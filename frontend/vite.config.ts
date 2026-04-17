// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // More-specific paths first (warehouse admin routes live in warehouse-service)
      '/api/admin/warehouses': { target: 'http://localhost:3007', changeOrigin: true },
      '/api/admin/carriers':   { target: 'http://localhost:3008', changeOrigin: true },

      // Auth / User
      '/api/auth':  { target: 'http://localhost:3001', changeOrigin: true },
      '/api/users': { target: 'http://localhost:3002', changeOrigin: true },

      // Product & Categories
      '/api/products':   { target: 'http://localhost:3003', changeOrigin: true },
      '/api/categories': { target: 'http://localhost:3003', changeOrigin: true },

      // Order / Cart / Review
      '/api/orders':  { target: 'http://localhost:3004', changeOrigin: true },
      '/api/cart':    { target: 'http://localhost:3005', changeOrigin: true },
      '/api/reviews': { target: 'http://localhost:3006', changeOrigin: true },

      // Warehouse
      '/api/warehouse': { target: 'http://localhost:3007', changeOrigin: true },
      '/api/carriers':  { target: 'http://localhost:3007', changeOrigin: true },

      // Admin / Feedback
      '/api/admin':    { target: 'http://localhost:3008', changeOrigin: true },
      '/api/feedback': { target: 'http://localhost:3008', changeOrigin: true },

      // Notification / Upload
      '/api/notifications': { target: 'http://localhost:3009', changeOrigin: true },
      '/api/upload':        { target: 'http://localhost:3010', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          ui: ['framer-motion', 'lucide-react'],
          charts: ['recharts'],
        },
      },
    },
  },
});
