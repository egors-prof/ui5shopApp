import Controller from "sap/ui/core/mvc/Controller";
import History from "sap/ui/core/routing/History";
import UIComponent from "sap/ui/core/UIComponent";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
export default class OrderDetail extends Controller {
    private _oDialog: Dialog | null = null;
    private _oActiveTicketTarget: any = null;
    private _oFeedbackDialog: Dialog | null = null;
    private _oActiveFeedbackContext: any = null;

    public onInit(): void {
        const oRouter = UIComponent.getRouterFor(this)as any;
        // Attach listener to catch the route parameter match pattern
        oRouter.getRoute("RouteOrderDetail").attachPatternMatched(this._onRouteMatched, this);
        const oModel = this.getOwnerComponent()!.getModel();
            const oOperation = (oModel as any).bindContext("/getMyRoles(...)");
            const oView = this.getView();
            oView!.setBusy(true); // Lock the UI view canvas while checking identity
            
            oOperation.execute().then(async () => {
                const oUserObj = oOperation.getBoundContext().getValue() as any;
                console.log("👤 Current secure Customer ID successfully loaded:", oUserObj);
                
                // 1. Establish the user session data storage safely
                const oUserModel = new JSONModel({ id: oUserObj });
                this.getView()!.setModel(oUserModel, "currentUser");
                
                // 2. SAFE SYNC: Now that we guarantee the model exists, kick off our UI sync logic!
                
                oView!.setBusy(false); // Release the UI lock
            }).catch((oError: any) => {
                console.error("Failed secure login initialization:", oError);
                oView!.setBusy(false);
            });
    }

    private _onRouteMatched(oEvent: any): void {
    const sOrderId = oEvent.getParameter("arguments").orderId;
    const oView = this.getView() as any  ;

    // 🟢 THE BULLETPROOF ODV4 FIX: Format both composite primary keys inside the canonical path string.
    // Note: The GUID string must be wrapped inside its own single quotes, and IsActiveEntity passes without quotes!
    const sCanonicalODataPath = `/Orders(ID='${sOrderId}',IsActiveEntity=true)`;

    console.log(`🎯 Binding Order Detail view to absolute context path: ${sCanonicalODataPath}`);

    // 🟢 FIXED: Forcing the OData V4 model engine to explicitly select your custom vendor column
    oView.bindElement({
        path: sCanonicalODataPath,
        parameters: {
            "$expand": "items($expand=product($select=ID);$select=ID,quantity,parent,priceAtOrder,product_vendor_ID)"
        }
    });
}

    public onNavBack(): void {
        const oHistory = History.getInstance();
        const sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
            window.history.go(-1);
        } else {
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCustomerDashboard", {}, true);
        }
    }


public onCreateOrderInteraction(oEvent: any): void {
        const oOrderContext = this.getView()!.getBindingContext();
        if (!oOrderContext) { return; }
        const oOrderData = oOrderContext.getObject() as any;

        // Cache the target identifiers needed for our database insertion payload
        this._oActiveTicketTarget = {
            order_ID: oOrderData.ID,
            orderItem_ID: null,
            vendor_ID: null,
            parent_ID: oOrderData.parent_ID || null,
            defaultTitle: `Global Issue with Order: ${oOrderData.orderNumber || ""}`
        };

        this._openInteractionFormDialog();
    }



    private async _openInteractionFormDialog(): Promise<void> {
        const oView = this.getView()!;

        // Instantiate the popout fragment only if it doesn't exist yet in memory
        if (!this._oDialog) {
            this._oDialog = await Fragment.load({
                id: oView.getId(),
                name: "test.view.CreateInteractionDialog", // Adjust this namespace prefix to match your manifest.json app id
                controller: this
            }) as Dialog;
            oView.addDependent(this._oDialog);
        }

        // Pre-populate the title input box with a helpful default value
        (oView.byId("txtInteractionTitle") as any).setValue(this._oActiveTicketTarget.defaultTitle);
        (oView.byId("txtInteractionSummary") as any).setValue(""); // Reset any prior text entries

        this._oDialog.open();
    }

    /**
     * Form Cancel Action: dismisses the pop out canvas cleanly
     */
    public onCloseInteractionDialog(): void {
        if (this._oDialog) {
            this._oDialog.close();
        }
    }



public onOpenOrderFeedback(oEvent: any): void {
        const oOrderContext = this.getView()!.getBindingContext();
        if (!oOrderContext) return;
        const oOrderData = oOrderContext.getObject() as any;

        this._oActiveFeedbackContext = {
            targetName: `Order Ledger Number: ${oOrderData.orderNumber || ""}`,
            payload: {
                order_ID: oOrderData.ID,
                orderItem_ID: null,
                interaction_ID: null
            }
        };
        this._openFeedbackDialog();
    }

    /**
     * TRIGGER B: Open feedback form for a specific VENDOR_ITEM row
     */
    public onOpenItemFeedback(oEvent: any): void {
        const oRowContext = oEvent.getSource().getBindingContext();
        if (!oRowContext) return;
        const oItemData = oRowContext.getObject() as any;

        this._oActiveFeedbackContext = {
            targetName: `Line Item Product: ID ${oItemData.product_ID?.substring(0, 8)}...`,
            payload: {
                order_ID: null,
                orderItem_ID: oItemData.ID,
                interaction_ID: null
            }
        };
        this._openFeedbackDialog();
    }

    /**
     * Asynchronously loads and presents the modal canvas fragment
     */
    private async _openFeedbackDialog(): Promise<void> {
        const oView = this.getView()!;

        if (!this._oFeedbackDialog) {
            this._oFeedbackDialog = await Fragment.load({
                id: oView.getId(),
                name: "test.view.CreateFeedbackDialog", // Adjust namespace prefix string to match manifest
                controller: this
            }) as Dialog;
            oView.addDependent(this._oFeedbackDialog);
        }

        // Dynamically adjust descriptive UI label text mapping before opening
        (oView.byId("txtFeedbackTargetName") as any).setText(this._oActiveFeedbackContext.targetName);
        (oView.byId("rateFeedbackStars") as any).setValue(5); // Reset to default full score
        (oView.byId("txtFeedbackComment") as any).setValue(""); // Reset prior comment logs

        this._oFeedbackDialog.open();
    }

    public onCloseFeedbackDialog(): void {
        if (this._oFeedbackDialog) {
            this._oFeedbackDialog.close();
        }
    }

    /**
     * SUBMIT REVIEWS: Saves raw inputs directly to the CAP OData backend pipeline layer
     */
    // Open your OrderDetail.controller.ts and look at your onSubmitFeedbackForm method
public async onSubmitFeedbackForm(): Promise<void> {
    const oView = this.getView()!;
    const oModel = oView.getModel();

    // Guard: Prevent crashing if context wasn't loaded properly
    if (!this._oActiveFeedbackContext || !this._oActiveFeedbackContext.payload) {
        MessageToast.show("Error: Feedback context is missing.");
        return;
    }

    // 1. Clean, direct extraction
    const iRatingValue = (oView.byId("rateFeedbackStars") as any).getValue();
    const sCommentText = (oView.byId("txtFeedbackComment") as any).getValue();

    // Enforce data validation check
    if (!sCommentText || !sCommentText.trim()) {
        MessageToast.show("Please enter a text review comment.");
        return;
    }

    const oUserModel = oView.getModel("currentUser") as any;
    const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");

    // 2. Direct list binding to the entity set
    const oFeedbackBindingList = (oModel as any).bindList("/Feedbacks");

    // 3. Construct clean payload dynamically (OData V4 friendly)
    const oFinalPayload: any = {
        "customer_ID": String(sCustomerId),
        "rating": parseInt(iRatingValue, 10),
        "comment": sCommentText.trim()
    };

    // ONLY append the mapping IDs if they actually have a value. 
    // OData V4 prefers omitting fields over passing primitive nulls for key targets.
    if (this._oActiveFeedbackContext.payload.order_ID) {
        oFinalPayload.order_ID = this._oActiveFeedbackContext.payload.order_ID;
    }
    if (this._oActiveFeedbackContext.payload.orderItem_ID) {
        oFinalPayload.orderItem_ID = this._oActiveFeedbackContext.payload.orderItem_ID;
    }
    if (this._oActiveFeedbackContext.payload.interaction_ID) {
        oFinalPayload.interaction_ID = this._oActiveFeedbackContext.payload.interaction_ID;
    }

    console.log("🚀 Cleaned OData Payload:", oFinalPayload);

    try {
        oView.setBusy(true);
        this.onCloseFeedbackDialog(); // Dismiss dialog popout early for a smooth UX transition

        // 4. Fire creation cycle matching the working interaction pattern
        const oNewContext = oFeedbackBindingList.create(oFinalPayload);
        await oNewContext.created();
        
        MessageToast.show("Thank you for your valuable feedback review!");
    } catch (oError: any) {
        console.error("❌ Failed to submit feedback form:", oError);
        MessageToast.show("Error submitting review.");
    } finally {
        oView.setBusy(false);
    }
}




    public onCreateItemInteraction(oEvent: any): void {
        const oRowContext = oEvent.getSource().getBindingContext();
        if (!oRowContext) { return; }
        const oItemData = oRowContext.getObject() as any;
        console.log(oItemData);
        console.log("vendor id ",oItemData.product?.vendor_ID);

        this._oActiveTicketTarget = {
            isGlobal: false,
            order_ID: oItemData.parent_ID,
            orderItem_ID: oItemData.ID,
            vendor_ID: oItemData.product_vendor_ID || null,
            defaultTitle: `Item Issue: Product ${oItemData.product_ID?.substring(0, 8)}`
        };

        this._openInteractionFormDialog();
    }


    public async onSubmitInteractionForm(): Promise<void> {
        const oView = this.getView()!;
        const oModel = oView.getModel();

        // Extract input strings directly from our open form controls
        const sInputTitle = (oView.byId("txtInteractionTitle") as any).getValue();
        const sInputPriority = (oView.byId("selInteractionPriority") as any).getSelectedKey();
        const sInputSummary = (oView.byId("txtInteractionSummary") as any).getValue();

        // Enforce a simple data validation check
        if (!sInputTitle || !sInputSummary) {
            MessageToast.show("Please fill out all required form fields.");
            return;
        }

        const oUserModel = oView.getModel("currentUser") as any;
        const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");
        console.log(sCustomerId);

        const oInteractionsList = (oModel as any).bindList("/Interactions");

        // Construct the unified enterprise payload using metadata and form inputs
        const oFinalPayload = {
            "title": sInputTitle,
            "summary": sInputSummary,
            "customer_ID": String(sCustomerId),
            "status_code": "OPEN",
            "priority_code": sInputPriority,
            "type_code": this._oActiveTicketTarget.isGlobal ? "INQUIRY" : "COMPLAINT",
            "currentOwner_code": "ADMIN",
            "caseNumber": `CASE-${new Date().toISOString().split('T')[0]}`,            
            
            "order_ID": this._oActiveTicketTarget.order_ID,
            "orderItem_ID": this._oActiveTicketTarget.orderItem_ID,
            "vendor_ID": this._oActiveTicketTarget.vendor_ID
        };

        try {
            oView.setBusy(true);
            this.onCloseInteractionDialog(); // Dismiss popout early for a smooth UX transition

            const oNewContext = oInteractionsList.create(oFinalPayload);
            await oNewContext.created();
            
            MessageToast.show("Your support case has been submitted successfully!");
        } catch (oError) {
            console.error("❌ Failed to commit interaction form:", oError);
            MessageToast.show("Error submitting ticket.");
        } finally {
            oView.setBusy(false);
        }
    }
}




