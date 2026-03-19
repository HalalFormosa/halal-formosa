import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';

export class DonationManager {
    donationIds = [
        'com.rcreative.support_1',
    ];

    products: any[] = [];
    isNative = Capacitor.isNativePlatform();

    constructor() {
        console.log("%c[DonationManager] Created", "color:#4CAF50;font-weight:bold;");
        console.log("[DonationManager] isNativePlatform:", this.isNative);
    }

    async initialize() {
        console.log("%c[DonationManager] initialize()", "color:#2196F3");

        if (!this.isNative) {
            console.warn("[DonationManager] ❌ Not native → skipping billing init.");
            return;
        }

        try {
            console.log("[DonationManager] Checking isBillingSupported…");
            const result = await NativePurchases.isBillingSupported();
            console.log("[DonationManager] isBillingSupported() →", result);

            if (!result?.isBillingSupported) {
                console.error("❌ Billing not supported!");
                return;
            }

            return await this.loadProducts();

        } catch (err) {
            this._logError("Billing init failed", err);
        }
    }

    async loadProducts() {
        console.log("%c[DonationManager] loadProducts()", "color:#673AB7");

        if (!this.isNative) return [];

        try {
            console.log("[DonationManager] Requesting INAPP products from Google Play…");
            console.log("[DonationManager] Product IDs:", this.donationIds);

            const response = await NativePurchases.getProducts({
                productIdentifiers: this.donationIds,
                productType: PURCHASE_TYPE.INAPP
            });

            console.log("%c[Google Play Response] products:", "color:#FF9800", response);

            if (!response.products?.length) {
                console.warn("%c⚠ Google Play returned ZERO products!", "color:orange;font-weight:bold;");
                console.warn("Possible causes:");
                console.warn("– ❌ App NOT installed from Play Store internal testing");
                console.warn("– ❌ You are using USB debug install → Play Store cannot verify");
                console.warn("– ❌ Wrong Google account (not in License Testing)");
                console.warn("– ❌ Products not ACTIVE on Play Console");
                console.warn("– ❌ Using SUBS accidentally instead of INAPP");
                console.warn("– ❌ Old build (different version code)");
            }

            this.products = [...response.products].sort((a, b) => a.price - b.price);

            console.log("%c[DonationManager] Sorted products:", "color:#4CAF50", this.products);

            return this.products;

        } catch (err) {
            this._logError("Failed loading donation products", err);
        }
    }

    async donate(productId: string) {
        console.log("%c[DonationManager] donate() →", "color:#009688", productId);

        if (!this.isNative) {
            alert("In-app purchases are only available on Android/iOS.");
            return { success: false };
        }

        try {
            const result = await NativePurchases.purchaseProduct({
                productIdentifier: productId,
                productType: PURCHASE_TYPE.INAPP,
                quantity: 1,
                isConsumable: true,
                autoAcknowledgePurchases: true,
            });

            console.log("%c[DonationManager] Purchase success:", "color:#4CAF50", result);

            return {
                success: true,
                transactionId: result.transactionId,
                productId: result.productIdentifier
            };

        } catch (err: any) {
            this._logError("Donation failed", err);

            if (err?.message?.includes("User cancelled")) {
                return { success: false, cancelled: true };
            }

            return { success: false, error: err };
        }
    }

    // 🟦 Typescript-safe error logger
    private _logError(label: string, err: unknown) {
        console.error(`%c[DonationManager] ❌ ${label}:`, "color:red", err);

        if (err instanceof Error) {
            console.error("[DonationManager] Stack:", err.stack);
        } else {
            console.error("[DonationManager] Non-Error thrown:", err);
        }
    }
}
