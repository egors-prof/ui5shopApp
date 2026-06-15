sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/core/routing/History", "sap/ui/core/UIComponent", "sap/ui/core/Fragment", "sap/m/MessageToast", "sap/ui/model/json/JSONModel"], function (Controller, History, UIComponent, Fragment, MessageToast, JSONModel) {
  "use strict";

  const OrderDetail = Controller.extend("webapp.controller.OrderDetail", {
    constructor: function constructor() {
      Controller.prototype.constructor.apply(this, arguments);
      this._oDialog = null;
      this._oActiveTicketTarget = null;
      this._oFeedbackDialog = null;
      this._oActiveFeedbackContext = null;
    },
    onInit: function _onInit() {
      const oRouter = UIComponent.getRouterFor(this);
      // Attach listener to catch the route parameter match pattern
      oRouter.getRoute("RouteOrderDetail").attachPatternMatched(this._onRouteMatched, this);
      const oModel = this.getOwnerComponent().getModel();
      const oOperation = oModel.bindContext("/getMyRoles(...)");
      const oView = this.getView();
      oView.setBusy(true); // Lock the UI view canvas while checking identity

      oOperation.execute().then(async () => {
        const oUserObj = oOperation.getBoundContext().getValue();
        console.log("👤 Current secure Customer ID successfully loaded:", oUserObj);

        // 1. Establish the user session data storage safely
        const oUserModel = new JSONModel({
          id: oUserObj
        });
        this.getView().setModel(oUserModel, "currentUser");

        // 2. SAFE SYNC: Now that we guarantee the model exists, kick off our UI sync logic!

        oView.setBusy(false); // Release the UI lock
      }).catch(oError => {
        console.error("Failed secure login initialization:", oError);
        oView.setBusy(false);
      });
    },
    _onRouteMatched: function _onRouteMatched(oEvent) {
      const sOrderId = oEvent.getParameter("arguments").orderId;
      const oView = this.getView();

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
    },
    onNavBack: function _onNavBack() {
      const oHistory = History.getInstance();
      const sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteCustomerDashboard", {}, true);
      }
    },
    onCreateOrderInteraction: function _onCreateOrderInteraction(oEvent) {
      const oOrderContext = this.getView().getBindingContext();
      if (!oOrderContext) {
        return;
      }
      const oOrderData = oOrderContext.getObject();

      // Cache the target identifiers needed for our database insertion payload
      this._oActiveTicketTarget = {
        order_ID: oOrderData.ID,
        orderItem_ID: null,
        vendor_ID: null,
        parent_ID: oOrderData.parent_ID || null,
        defaultTitle: `Global Issue with Order: ${oOrderData.orderNumber || ""}`
      };
      this._openInteractionFormDialog();
    },
    _openInteractionFormDialog: async function _openInteractionFormDialog() {
      const oView = this.getView();

      // Instantiate the popout fragment only if it doesn't exist yet in memory
      if (!this._oDialog) {
        this._oDialog = await Fragment.load({
          id: oView.getId(),
          name: "test.view.CreateInteractionDialog",
          // Adjust this namespace prefix to match your manifest.json app id
          controller: this
        });
        oView.addDependent(this._oDialog);
      }

      // Pre-populate the title input box with a helpful default value
      oView.byId("txtInteractionTitle").setValue(this._oActiveTicketTarget.defaultTitle);
      oView.byId("txtInteractionSummary").setValue(""); // Reset any prior text entries

      this._oDialog.open();
    },
    /**
     * Form Cancel Action: dismisses the pop out canvas cleanly
     */
    onCloseInteractionDialog: function _onCloseInteractionDialog() {
      if (this._oDialog) {
        this._oDialog.close();
      }
    },
    onOpenOrderFeedback: function _onOpenOrderFeedback(oEvent) {
      const oOrderContext = this.getView().getBindingContext();
      if (!oOrderContext) return;
      const oOrderData = oOrderContext.getObject();
      this._oActiveFeedbackContext = {
        targetName: `Order Ledger Number: ${oOrderData.orderNumber || ""}`,
        payload: {
          order_ID: oOrderData.ID,
          orderItem_ID: null,
          interaction_ID: null
        }
      };
      this._openFeedbackDialog();
    },
    /**
     * TRIGGER B: Open feedback form for a specific VENDOR_ITEM row
     */
    onOpenItemFeedback: function _onOpenItemFeedback(oEvent) {
      const oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) return;
      const oItemData = oRowContext.getObject();
      this._oActiveFeedbackContext = {
        targetName: `Line Item Product: ID ${oItemData.product_ID?.substring(0, 8)}...`,
        payload: {
          order_ID: null,
          orderItem_ID: oItemData.ID,
          interaction_ID: null
        }
      };
      this._openFeedbackDialog();
    },
    /**
     * Asynchronously loads and presents the modal canvas fragment
     */
    _openFeedbackDialog: async function _openFeedbackDialog() {
      const oView = this.getView();
      if (!this._oFeedbackDialog) {
        this._oFeedbackDialog = await Fragment.load({
          id: oView.getId(),
          name: "test.view.CreateFeedbackDialog",
          // Adjust namespace prefix string to match manifest
          controller: this
        });
        oView.addDependent(this._oFeedbackDialog);
      }

      // Dynamically adjust descriptive UI label text mapping before opening
      oView.byId("txtFeedbackTargetName").setText(this._oActiveFeedbackContext.targetName);
      oView.byId("rateFeedbackStars").setValue(5); // Reset to default full score
      oView.byId("txtFeedbackComment").setValue(""); // Reset prior comment logs

      this._oFeedbackDialog.open();
    },
    onCloseFeedbackDialog: function _onCloseFeedbackDialog() {
      if (this._oFeedbackDialog) {
        this._oFeedbackDialog.close();
      }
    },
    /**
     * SUBMIT REVIEWS: Saves raw inputs directly to the CAP OData backend pipeline layer
     */
    // Open your OrderDetail.controller.ts and look at your onSubmitFeedbackForm method
    onSubmitFeedbackForm: async function _onSubmitFeedbackForm() {
      const oView = this.getView();
      const oModel = oView.getModel();

      // Guard: Prevent crashing if context wasn't loaded properly
      if (!this._oActiveFeedbackContext || !this._oActiveFeedbackContext.payload) {
        MessageToast.show("Error: Feedback context is missing.");
        return;
      }

      // 1. Clean, direct extraction
      const iRatingValue = oView.byId("rateFeedbackStars").getValue();
      const sCommentText = oView.byId("txtFeedbackComment").getValue();

      // Enforce data validation check
      if (!sCommentText || !sCommentText.trim()) {
        MessageToast.show("Please enter a text review comment.");
        return;
      }
      const oUserModel = oView.getModel("currentUser");
      const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");

      // 2. Direct list binding to the entity set
      const oFeedbackBindingList = oModel.bindList("/Feedbacks");

      // 3. Construct clean payload dynamically (OData V4 friendly)
      const oFinalPayload = {
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
      } catch (oError) {
        console.error("❌ Failed to submit feedback form:", oError);
        MessageToast.show("Error submitting review.");
      } finally {
        oView.setBusy(false);
      }
    },
    onCreateItemInteraction: function _onCreateItemInteraction(oEvent) {
      const oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      const oItemData = oRowContext.getObject();
      console.log(oItemData);
      console.log("vendor id ", oItemData.product?.vendor_ID);
      this._oActiveTicketTarget = {
        isGlobal: false,
        order_ID: oItemData.parent_ID,
        orderItem_ID: oItemData.ID,
        vendor_ID: oItemData.product_vendor_ID || null,
        defaultTitle: `Item Issue: Product ${oItemData.product_ID?.substring(0, 8)}`
      };
      this._openInteractionFormDialog();
    },
    onSubmitInteractionForm: async function _onSubmitInteractionForm() {
      const oView = this.getView();
      const oModel = oView.getModel();

      // Extract input strings directly from our open form controls
      const sInputTitle = oView.byId("txtInteractionTitle").getValue();
      const sInputPriority = oView.byId("selInteractionPriority").getSelectedKey();
      const sInputSummary = oView.byId("txtInteractionSummary").getValue();

      // Enforce a simple data validation check
      if (!sInputTitle || !sInputSummary) {
        MessageToast.show("Please fill out all required form fields.");
        return;
      }
      const oUserModel = oView.getModel("currentUser");
      const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");
      console.log(sCustomerId);
      const oInteractionsList = oModel.bindList("/Interactions");

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
  });
  return OrderDetail;
});
//# sourceMappingURL=OrderDetail-dbg.controller.js.map
