
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function to create a mirror contact when a user links a debtor to another app user.
 * This function triggers on the update of a debtor document.
 */
export const onDebtorLink = functions.firestore
    .document("/users/{userId}/debtors/{debtorId}")
    .onUpdate(async (change, context) => {
        const { userId, debtorId } = context.params;
        console.log(`[onDebtorLink] Triggered for user: ${userId}, debtor: ${debtorId}`);

        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Log the data for debugging purposes
        console.log(`[onDebtorLink] Data before: ${JSON.stringify(beforeData)}`);
        console.log(`[onDebtorLink] Data after: ${JSON.stringify(afterData)}`);

        const isNowAppUser = afterData.isAppUser === true;
        const uidChanged = beforeData.appUserId !== afterData.appUserId;
        const hasLinkedId = afterData.appUserId && afterData.appUserId.length > 0;

        console.log(`[onDebtorLink] Condition check: isNowAppUser=${isNowAppUser}, uidChanged=${uidChanged}, hasLinkedId=${hasLinkedId}`);

        // Proceed only if the contact is marked as an app user, has a linked UID, and the UID has actually changed.
        if (isNowAppUser && hasLinkedId && uidChanged) {
            const linkedUserId = afterData.appUserId;
            console.log(`[onDebtorLink] CONDITION MET: User ${userId} linked contact ${debtorId} to app user ${linkedUserId}.`);

            try {
                // Get the collection of debtors for the user who is being linked.
                const linkedUserDebtorsCol = db.collection(`users/${linkedUserId}/debtors`);
                
                console.log(`[onDebtorLink] Checking for existing mirror contact in ${linkedUserId}'s list where appUserId == ${userId}`);

                // Check if a mirror contact already exists to avoid duplicates.
                const mirrorContactQuery = await linkedUserDebtorsCol.where("appUserId", "==", userId).limit(1).get();

                if (mirrorContactQuery.empty) {
                    console.log(`[onDebtorLink] No mirror contact found. Proceeding to create one.`);
                    
                    // Fetch the auth data of the user who initiated the link to get their name.
                    const initiatingUserAuth = await admin.auth().getUser(userId);
                    
                    const mirrorContactData = {
                        name: initiatingUserAuth.displayName || initiatingUserAuth.email?.split('@')[0] || `Usuario ${userId.substring(0, 5)}`,
                        type: "person",
                        isAppUser: true,
                        appUserId: userId,      // Link back to the initiating user.
                        userId: linkedUserId,   // CRITICAL: The owner of this new document.
                        paymentMethod: "Otro",
                        paymentInfo: "Usuario de la App",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    };

                    console.log(`[onDebtorLink] Creating mirror contact with data: ${JSON.stringify(mirrorContactData)}`);
                    
                    // Create the new mirror contact document.
                    await linkedUserDebtorsCol.add(mirrorContactData);
                    
                    console.log(`✅ [onDebtorLink] SUCCESS: Mirror contact for ${userId} created in ${linkedUserId}'s list.`);

                } else {
                    const existingDocId = mirrorContactQuery.docs[0].id;
                    console.log(`ℹ️ [onDebtorLink] INFO: Mirror contact already exists for user ${userId} in ${linkedUserId}'s list (Doc ID: ${existingDocId}). No action needed.`);
                }
            } catch (error) {
                console.error(`❌ [onDebtorLink] ERROR creating mirror contact for ${userId} in ${linkedUserId}'s list.`, error);
                // We don't re-throw the error to prevent the function from retrying on a permanent failure.
            }
        } else {
            console.log(`[onDebtorLink] Conditions not met. No action taken.`);
        }
    });
