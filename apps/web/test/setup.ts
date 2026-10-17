import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react only auto-cleans when vitest globals are enabled;
// this project keeps them off, so unmount between tests explicitly.
afterEach(() => cleanup());
