import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        await WebhookHandlers.handleConnectEvent(event);
      } else {
        const rawEvent = JSON.parse(payload.toString());
        await WebhookHandlers.handleConnectEvent(rawEvent);
      }
    } catch (err: any) {
      console.log('[Connect Webhook] Non-critical processing:', err.message);
    }
  }

  static async handleConnectEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object;
        const accountId = account.id;
        const detailsSubmitted = account.details_submitted || false;
        const payoutsEnabled = account.payouts_enabled || false;

        let status = 'pending';
        if (detailsSubmitted && payoutsEnabled) status = 'active';
        else if (detailsSubmitted) status = 'restricted';
        else if (account.disabled_reason) status = 'disabled';

        const artistId = account.metadata?.artistId;
        if (artistId) {
          try {
            await storage.updateArtistConnectStatus(parseInt(artistId), {
              stripeConnectStatus: status,
              stripeConnectDetailsSubmitted: detailsSubmitted,
              stripeConnectPayoutsEnabled: payoutsEnabled,
            });
            console.log(`[Connect] Account ${accountId} updated: status=${status}, payouts=${payoutsEnabled}`);
          } catch (e: any) {
            console.log(`[Connect] Could not update artist ${artistId}:`, e.message);
          }
        }
        break;
      }

      case 'transfer.paid':
      case 'transfer.failed': {
        const transfer = event.data.object;
        const transferId = transfer.id;
        const succeeded = event.type === 'transfer.paid';

        const payouts = await findPayoutByTransferId(transferId);
        if (payouts) {
          await storage.updatePayoutRequest(payouts.id, {
            status: succeeded ? 'paid' : 'failed',
            failureReason: succeeded ? null : (transfer.failure_message || 'Transfer failed'),
            processedAt: new Date(),
          });

          if (!succeeded) {
            const wallet = await storage.getOrCreateArtistWallet(payouts.artistId);
            const amountToRestore = payouts.amountCents;
            await storage.updateArtistWalletBalance(payouts.artistId, amountToRestore, 0);
            await storage.createWalletTransaction({
              artistId: payouts.artistId,
              type: 'adjustment',
              description: `Payout refund - transfer failed: $${(amountToRestore / 100).toFixed(2)}`,
              grossAmountCents: amountToRestore,
              platformFeeCents: 0,
              netAmountCents: amountToRestore,
              balanceAfterCents: (wallet.balanceCents || 0) + amountToRestore,
            });
          }
          console.log(`[Connect] Transfer ${transferId}: ${succeeded ? 'paid' : 'failed'}`);
        }
        break;
      }

      case 'payout.paid':
      case 'payout.failed': {
        const payout = event.data.object;
        const payoutId = payout.id;
        const succeeded = event.type === 'payout.paid';

        const payoutReq = await findPayoutByStripePayoutId(payoutId);
        if (payoutReq) {
          await storage.updatePayoutRequest(payoutReq.id, {
            status: succeeded ? 'paid' : 'failed',
            failureReason: succeeded ? null : (payout.failure_message || 'Payout failed'),
            processedAt: new Date(),
          });

          if (!succeeded && payoutReq.status !== 'failed') {
            const wallet = await storage.getOrCreateArtistWallet(payoutReq.artistId);
            await storage.updateArtistWalletBalance(payoutReq.artistId, payoutReq.amountCents, 0);
            await storage.createWalletTransaction({
              artistId: payoutReq.artistId,
              type: 'adjustment',
              description: `Payout refund - instant payout failed: $${(payoutReq.amountCents / 100).toFixed(2)}`,
              grossAmountCents: payoutReq.amountCents,
              platformFeeCents: 0,
              netAmountCents: payoutReq.amountCents,
              balanceAfterCents: (wallet.balanceCents || 0) + payoutReq.amountCents,
            });
          }
          console.log(`[Connect] Payout ${payoutId}: ${succeeded ? 'paid' : 'failed'}`);
        }
        break;
      }
    }
  }
}

async function findPayoutByTransferId(transferId: string) {
  const { db } = await import('./db');
  const { payoutRequests } = await import('@shared/schema');
  const [result] = await db.select().from(payoutRequests).where(eq(payoutRequests.stripeTransferId, transferId)).limit(1);
  return result || null;
}

async function findPayoutByStripePayoutId(payoutId: string) {
  const { db } = await import('./db');
  const { payoutRequests } = await import('@shared/schema');
  const [result] = await db.select().from(payoutRequests).where(eq(payoutRequests.stripePayoutId, payoutId)).limit(1);
  return result || null;
}
