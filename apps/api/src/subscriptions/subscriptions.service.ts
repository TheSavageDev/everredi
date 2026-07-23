import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVERREDI_PRO_ENTITLEMENT } from '@everredi/types';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { revenuecatCustomers, users } from '../db/schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async status(userId: string) {
    const user = await this.usersService.getById(userId);
    const premium =
      user.subscriptionTier === 'premium' &&
      user.subscriptionStatus === 'active' &&
      (!user.subscriptionExpiresAt ||
        new Date(user.subscriptionExpiresAt).getTime() > Date.now());
    return {
      tier: premium ? ('premium' as const) : ('free' as const),
      status: user.subscriptionStatus,
      expiresAt: user.subscriptionExpiresAt,
      entitlement: premium ? EVERREDI_PRO_ENTITLEMENT : null,
    };
  }

  assertWebhookSecret(headerSecret?: string) {
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!expected) return;
    if (!headerSecret || headerSecret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  async handleRevenueCatWebhook(payload: Record<string, unknown>) {
    const event = (payload.event as Record<string, unknown> | undefined) ?? payload;
    const type = String(event.type ?? payload.type ?? '');
    const appUserId = String(
      event.app_user_id ?? event.appUserId ?? payload.app_user_id ?? '',
    );
    if (!appUserId) return { handled: false, reason: 'missing app_user_id' };

    const entitlementId =
      this.config.get<string>('REVENUECAT_ENTITLEMENT_ID') ??
      EVERREDI_PRO_ENTITLEMENT;

    const entitlements =
      (event.entitlement_ids as string[] | undefined) ??
      (event.entitlements as string[] | undefined) ??
      [];

    // Prefer explicit entitlement list when present; never reintroduce everredi_pro as canonical
    const granted =
      entitlements.length > 0
        ? entitlements.includes(entitlementId) || entitlements.includes('everredi_pro')
        : ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'].some(
            (t) => type.includes(t),
          );

    const expiredEvent = ['EXPIRATION', 'CANCELLATION'].some((t) =>
      type.includes(t),
    );

    let userId = appUserId;
    const [byId] = await this.db.select().from(users).where(eq(users.id, appUserId)).limit(1);
    if (!byId) {
      const [mapped] = await this.db
        .select()
        .from(revenuecatCustomers)
        .where(eq(revenuecatCustomers.appUserId, appUserId))
        .limit(1);
      if (mapped) userId = mapped.userId;
      else return { handled: false, reason: 'unknown user' };
    }

    await this.db
      .insert(revenuecatCustomers)
      .values({ userId, appUserId })
      .onConflictDoUpdate({
        target: revenuecatCustomers.userId,
        set: { appUserId, updatedAt: new Date() },
      });

    const expiration = event.expiration_at_ms
      ? new Date(Number(event.expiration_at_ms))
      : event.expiration_at
        ? new Date(String(event.expiration_at))
        : null;

    if (expiredEvent && !granted) {
      await this.usersService.setEntitlement(userId, false, expiration, 'expired');
      return { handled: true, premium: false, entitlementId };
    }

    if (granted) {
      await this.usersService.setEntitlement(userId, true, expiration, 'active');
      return { handled: true, premium: true, entitlementId };
    }

    return { handled: true, premium: false, type, entitlementId };
  }
}
