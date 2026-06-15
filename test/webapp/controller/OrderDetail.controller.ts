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

  
    const sCanonicalODataPath = `/Orders(ID='${sOrderId}',IsActiveEntity=true)`;

    console.log(`🎯 Binding Order Detail view to absolute context path: ${sCanonicalODataPath}`);

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
        if (!this._oDialog) {
            this._oDialog = await Fragment.load({
                id: oView.getId(),
                name: "test.view.CreateInteractionDialog", // Adjust this namespace prefix to match your manifest.json app id
                controller: this
            }) as Dialog;
            oView.addDependent(this._oDialog);
        }

        (oView.byId("txtInteractionTitle") as any).setValue(this._oActiveTicketTarget.defaultTitle);
        (oView.byId("txtInteractionSummary") as any).setValue(""); // Reset any prior text entries

        this._oDialog.open();
    }


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


    private async _openFeedbackDialog(): Promise<void> {
        const oView = this.getView()!;

        if (!this._oFeedbackDialog) {
            this._oFeedbackDialog = await Fragment.load({
                id: oView.getId(),
                name: "test.view.CreateFeedbackDialog", 
                controller: this
            }) as Dialog;
            oView.addDependent(this._oFeedbackDialog);
        }

        (oView.byId("txtFeedbackTargetName") as any).setText(this._oActiveFeedbackContext.targetName);
        (oView.byId("rateFeedbackStars") as any).setValue(5);
        (oView.byId("txtFeedbackComment") as any).setValue("");

        this._oFeedbackDialog.open();
    }

    public onCloseFeedbackDialog(): void {
        if (this._oFeedbackDialog) {
            this._oFeedbackDialog.close();
        }
    }


public async onSubmitFeedbackForm(): Promise<void> {
    const oView = this.getView()!;
    const oModel = oView.getModel();

    if (!this._oActiveFeedbackContext || !this._oActiveFeedbackContext.payload) {
        MessageToast.show("Error: Feedback context is missing.");
        return;
    }
    const iRatingValue = (oView.byId("rateFeedbackStars") as any).getValue();
    const sCommentText = (oView.byId("txtFeedbackComment") as any).getValue();
    if (!sCommentText || !sCommentText.trim()) {
        MessageToast.show("Please enter a text review comment.");
        return;
    }

    const oUserModel = oView.getModel("currentUser") as any;
    const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");

    const oFeedbackBindingList = (oModel as any).bindList("/Feedbacks");

    const oFinalPayload: any = {
        "customer_ID": String(sCustomerId),
        "rating": parseInt(iRatingValue, 10),
        "comment": sCommentText.trim()
    };

    if (this._oActiveFeedbackContext.payload.order_ID) {
        oFinalPayload.order_ID = this._oActiveFeedbackContext.payload.order_ID;
    }
    if (this._oActiveFeedbackContext.payload.orderItem_ID) {
        oFinalPayload.orderItem_ID = this._oActiveFeedbackContext.payload.orderItem_ID;
    }
    if (this._oActiveFeedbackContext.payload.interaction_ID) {
        oFinalPayload.interaction_ID = this._oActiveFeedbackContext.payload.interaction_ID;
    }

    console.log("Cleaned OData Payload:", oFinalPayload);

    try {
        oView.setBusy(true);
        this.onCloseFeedbackDialog(); 

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

        const sInputTitle = (oView.byId("txtInteractionTitle") as any).getValue();
        const sInputPriority = (oView.byId("selInteractionPriority") as any).getSelectedKey();
        const sInputSummary = (oView.byId("txtInteractionSummary") as any).getValue();

        if (!sInputTitle || !sInputSummary) {
            MessageToast.show("Please fill out all required form fields.");
            return;
        }

        const oUserModel = oView.getModel("currentUser") as any;
        const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");
        console.log(sCustomerId);

        const oInteractionsList = (oModel as any).bindList("/Interactions");

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
            this.onCloseInteractionDialog(); 
            const oNewContext = oInteractionsList.create(oFinalPayload);
            await oNewContext.created();
            
            MessageToast.show("Your support case has been submitted successfully!");
        } catch (oError) {
            console.error("Failed to commit interaction form:", oError);
            MessageToast.show("Error submitting ticket.");
        } finally {
            oView.setBusy(false);
        }
    }
}




