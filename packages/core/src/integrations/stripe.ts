import Stripe from "stripe";
import { supabaseAdmin } from "../db/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_build_placeholder", {
  apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
  typescript: true,
});

export class StripeService {
  /**
   * Cria uma sessão de checkout para upgrade de plano
   */
  static async createCheckoutSession({
    companyId,
    ownerEmail,
    priceId,
    successUrl,
    cancelUrl,
  }: {
    companyId: string;
    ownerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: ownerEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        companyId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session;
  }

  /**
   * Cria uma sessão do Portal do Cliente para gerenciamento de cartão e cancelamento
   */
  static async createBillingPortalSession({
    stripeCustomerId,
    returnUrl,
  }: {
    stripeCustomerId: string;
    returnUrl: string;
  }) {
    return stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
  }

  /**
   * Processador de eventos dos Webhooks do Stripe via Supabase
   */
  static async handleWebhookEvent(event: Stripe.Event) {
    const now = new Date().toISOString();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;

        if (companyId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const priceId = subscription.items.data[0]?.price.id;
          const isPro = priceId === process.env.STRIPE_PRICE_ID_PRO;

          const { error } = await supabaseAdmin
            .from("Company")
            .update({
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              planTier: isPro ? "PRO" : "BASIC",
              subscriptionStatus: "ACTIVE",
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              updatedAt: now,
            })
            .eq("id", companyId);

          if (error) {
            console.error("Erro ao atualizar Company no checkout.session.completed:", error.message);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        const isPro = priceId === process.env.STRIPE_PRICE_ID_PRO;

        let status = "ACTIVE";
        if (subscription.status === "past_due") status = "PAST_DUE";
        if (subscription.status === "canceled") status = "CANCELED";
        if (subscription.status === "unpaid") status = "UNPAID";

        const { error } = await supabaseAdmin
          .from("Company")
          .update({
            planTier: isPro ? "PRO" : "BASIC",
            subscriptionStatus: status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            updatedAt: now,
          })
          .eq("stripeSubscriptionId", subscription.id);

        if (error) {
          console.error("Erro ao atualizar Company no customer.subscription.updated:", error.message);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const { error } = await supabaseAdmin
          .from("Company")
          .update({
            planTier: "BASIC",
            subscriptionStatus: "CANCELED",
            updatedAt: now,
          })
          .eq("stripeSubscriptionId", subscription.id);

        if (error) {
          console.error("Erro ao cancelar Company no customer.subscription.deleted:", error.message);
        }
        break;
      }
    }
  }
}
