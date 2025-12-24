import { SetMetadata } from '@nestjs/common';

export const PREMIUM_KEY = 'isPremiumRoute';

export const Premium = () => SetMetadata(PREMIUM_KEY, true);



