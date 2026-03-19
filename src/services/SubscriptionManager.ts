import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { Capacitor } from "@capacitor/core";

export class SubscriptionManager {
    productId: string;
    basePlanId: string;

    constructor(productId: string, basePlanId: string) {
        this.productId = productId;
        this.basePlanId = basePlanId;
    }

    async initialize() {
        try {
            const { isBillingSupported } = await NativePurchases.isBillingSupported();
            return isBillingSupported;
        } catch {
            return false;
        }
    }

    async loadProduct() {
        const { product } = await NativePurchases.getProduct({
            productIdentifier: this.productId,
            productType: PURCHASE_TYPE.SUBS
        });
        return product;
    }

    async purchase() {
        const isAndroid = Capacitor.getPlatform() === "android";

        const tx: any = await NativePurchases.purchaseProduct({
            productIdentifier: this.productId,
            productType: PURCHASE_TYPE.SUBS,
            planIdentifier: isAndroid ? this.basePlanId : undefined,
            quantity: 1
        });

        return {
            transactionId: tx.transactionId ?? null,
            productId: tx.productIdentifier ?? this.productId,
            purchaseToken: tx.purchaseToken ?? null,
        };
    }

    async checkActive() {
        const { purchases } = await NativePurchases.getPurchases({
            productType: PURCHASE_TYPE.SUBS
        });

        return purchases.some(p => p.productIdentifier === this.productId);
    }
}
