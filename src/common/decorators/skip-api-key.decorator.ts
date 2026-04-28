import { SetMetadata } from '@nestjs/common';

export const SKIP_API_KEY = 'skipApiKey';

/** Exempt a route from the global API key check. */
export const SkipApiKey = () => SetMetadata(SKIP_API_KEY, true);
