import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: [
      { find: /^npm:(.+)$/, replacement: '$1' },
      { find: /^jsr:@supabase\/supabase-js@.+$/, replacement: '@supabase/supabase-js' },
    ],
  },
});
