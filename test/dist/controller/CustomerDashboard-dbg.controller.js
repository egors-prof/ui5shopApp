sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/core/UIComponent", "sap/ui/core/routing/History", "sap/ui/core/Fragment", "sap/m/MessageToast", "sap/ui/model/json/JSONModel"], function (Controller, UIComponent, History, Fragment, MessageToast, JSONModel) {
  "use strict";

  const CustomerDashboardController = Controller.extend("webapp.controller.CustomerDashboardController", {
    constructor: function constructor() {
      Controller.prototype.constructor.apply(this, arguments);
      this._oFeedbackDialog = null;
      this._oActiveFeedbackContext = null;
    },
    onInit: function _onInit() {
      console.log("init");
      var oRouter = UIComponent.getRouterFor(this);
      if (!oRouter) {
        return;
      }
      oRouter.getRoute("RouteCustomerDashboard").attachPatternMatched(this._onRouteMatched, this);
      this._loadUserSessionProfile();
    },
    _onViewDisplayLogged: function _onViewDisplayLogged(oEvent) {
      console.log(`[NAVIGATION LOG] 🚪 User entered view target at ${new Date().toLocaleTimeString()}`);
    },
    _onRouteMatched: function _onRouteMatched(oEvent) {
      // TypeScript now perfectly understands .getParameter()!
      console.log("matched");
      const oArgs = oEvent.getParameter("arguments");
      console.log("Captured Routing Arguments:", oArgs); // <-- ADD THIS LOG
      if (!oArgs) {
        return;
      }
      const oQuery = oArgs["?query"];
      console.log("Captured Query Object:", oQuery); // <-- ADD THIS LOG

      if (oQuery && oQuery.tab === "cart") {
        console.log("cart");
        const oIconTabBar = this.byId("dashboardTabBar");
        if (oIconTabBar) {
          oIconTabBar.setSelectedKey("cartTab");
          const oFooterToolbar = this.byId("cartFooterToolbar");
          oFooterToolbar.setVisible(true);
          const oList = this.byId("dashboardCartList");
          const oBinding = oList.getBinding("items");
          if (oBinding) {
            oBinding.refresh();
          }
          const iIntervalId = setInterval(() => {
            const aItems = oList.getItems();
            if (aItems && aItems.length > 0) {
              console.log(`⚡ Success! Found ${aItems.length} items in the list. Running sum...`);
              clearInterval(iIntervalId);
              this.getSumCart();
            }
          }, 300);
          setTimeout(() => clearInterval(iIntervalId), 5000);
          this.getSumCart();
        }
      } else if (oQuery && oQuery.tab === "personalInfo") {
        const oIconTabBar = this.byId("dashboardTabBar");
        if (oIconTabBar) {
          oIconTabBar.setSelectedKey("profileTab");
        }
      } else if (oQuery && oQuery.tab === "support") {
        console.log("support");
        const oIconTabBar = this.byId("dashboardTabBar");
        if (oIconTabBar) {
          oIconTabBar.setSelectedKey("interactionsTab");
        }
      } else if (oQuery && oQuery.tab === "wishlist") {
        console.log("wishlist");
        const oIconTabBar = this.byId("dashboardTabBar");
        if (oIconTabBar) {
          oIconTabBar.setSelectedKey("wishlistTab");
        }
      }
    },
    authPress: function _authPress() {
      const oModel = this.getOwnerComponent().getModel();
      const oOperation = oModel.bindContext("/triggerAuth(...)");
      const oView = this.getView();
      oView.setBusy(true); // Lock the UI view canvas while checking identity

      oOperation.execute().then(async () => {
        oView.setBusy(false); // Release the UI lock
      }).catch(oError => {
        console.error("Failed to trigger authentication:", oError);
        oView.setBusy(false);
      });
    },
    onProductPress: function _onProductPress(oEvent) {
      const oListItem = oEvent.getSource();
      const oBindingContext = oListItem.getBindingContext();
      const oProduct = oBindingContext.getObject();
      console.log(oBindingContext);
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteProductObjectPage", {
        productId: oProduct.product.ID
      });
    },
    onRemoveCartItem: async function _onRemoveCartItem(oEvent) {
      const oButton = oEvent.getSource();
      const oContext = oButton.getBindingContext();
      if (!oContext) return;
      const oView = this.getView();
      oView?.setBusy(true);
      try {
        const sItemName = oContext.getProperty("product/name") || "Item";
        await oContext.delete();
        MessageToast.show(`🧹 ${sItemName} successfully removed from your cart.`);
        this.getSumCart();
      } catch (oError) {
        console.error("❌ Failed to delete draft item: ", oError);
        MessageToast.show("Unable to remove item. Please try again.");
      } finally {
        oView?.setBusy(false);
      }
    },
    onExit: function _onExit() {
      const oRouter = UIComponent.getRouterFor(this);
      if (oRouter) {
        const oRoute = oRouter.getRoute("TargetCustomerDashboard");
        if (oRoute) {
          oRoute.detachPatternMatched(this._onViewDisplayLogged, this);
        }
      }
    },
    _onDashboardMatched: function _onDashboardMatched() {
      const oView = this.getView();
      const oUserModel = oView.getModel("currentUser");
      if (oUserModel) {
        console.log("👤 Live Profile Session Model Initialized:", JSON.stringify(oUserModel.getData()));
      }
    },
    onBeforeRendering: function _onBeforeRendering() {
      const oRouter = UIComponent.getRouterFor(this);
      if (oRouter) {
        const oRoute = oRouter.getRoute("TargetCustomerDashboard");
        if (oRoute) {
          // Detach first to prevent duplicate memory leak listeners stacking up
          oRoute.detachPatternMatched(this._onViewDisplayLogged, this);
          // Freshly attach the pattern handler for this page visit cycle
          oRoute.attachPatternMatched(this._onViewDisplayLogged, this);
          console.log("🔄 Router pattern listener re-bound successfully.");
        }
      }
      setTimeout(() => {
        const oView = this.getView();
        const oUserModel = oView.getModel("currentUser");
        console.log("model ", oUserModel);
        if (oUserModel) {
          const data = oUserModel.getData();
          console.log("data", data);
          const nameText = this.byId("fullNameText");
          const emailText = this.byId("emailText");
          const statusText = this.byId("statusText");
          nameText.setText(" " + data.profile.firstName + " " + data.profile.lastName);
          emailText.setText(" " + data.profile.email);
          statusText.setText(" " + data.profile.customerStatus_code);
        }
      }, 1000);
    },
    _loadUserSessionProfile: function _loadUserSessionProfile() {
      console.log("loading");
      const oView = this.getView();
      if (!oView) {
        return;
      }
      oView.setBusy(true);

      // 1. Cast the core model to an OData V4 Model instance cleanly
      const oModel = this.getOwnerComponent().getModel();
      console.log(oModel);
      if (!oModel) {
        oView.setBusy(false);
        return;
      }

      // 2. Bind straight to your custom function path
      const oOperation = oModel.bindContext("/getMyRoles(...)");
      console.log(oOperation);

      // 3. Execute the operation down the wire
      oOperation.execute().then(() => {
        const oContext = oOperation.getBoundContext();
        if (oContext) {
          const oResultData = oContext.getObject();

          // 4. Create the local JSONModel with the structured data map
          const oUserProfileModel = new JSONModel({
            isCRMAdmin: oResultData.isCRMAdmin,
            isVendor: oResultData.isVendor,
            username: oResultData.username,
            id: oResultData.id,
            // Spread the nested customerProfile attributes safely
            profile: oResultData.customerProfile || {
              firstName: "Guest",
              lastName: "User",
              email: "N/A"
            }
          });

          // 5. Attach it to the active view container layout using the model name prefix
          oView.setModel(oUserProfileModel, "currentUser");
        }
        oView.setBusy(false);
      }).catch(oError => {
        oView.setBusy(false);
        MessageToast.show("Error loading personal profile information.");
        console.error("❌ Profile load failed:", oError);
      });
    },
    onShowOrdersPress: async function _onShowOrdersPress() {
      const oTable = this.byId("ordersHistoryTable");
      const oButton = this.byId("showOrdersButton");
      if (!oTable || !oButton) return;
      const bIsCurrentlyVisible = oTable.getVisible();
      const bNewVisibilityState = !bIsCurrentlyVisible;

      // 1. Toggle visibility
      oTable.setVisible(bNewVisibilityState);
      if (bNewVisibilityState) {
        // 2. Flip Button properties to "Hide" mode
        oButton.setText("Hide Order History");
        oButton.setIcon("sap-icon://hide");
        oButton.setType("Default");

        // 3. Force OData stream to fetch fresh finalized checkouts from the main ledger
        const oBinding = oTable.getBinding("items");
        if (oBinding) {
          const aContexts = oBinding.getCurrentContexts();

          // 3. Loop through the array to extract the raw JavaScript data objects
          aContexts.forEach(oContext => {
            const oRowObject = oContext.getObject();

            // Now you can read properties straight from the database response data!
            console.log("Found Active Order ID:", oRowObject.ID);
            console.log("Virtual Total Amount:", oRowObject.totalAmount);
          });
          const aAllTableObjects = aContexts.map(oContext => oContext.getObject());
          console.log("Complete table data payload array:", aAllTableObjects);
        }
        if (oBinding) {
          oBinding.refresh();
          console.log("📥 Fresh historic orders loaded from main ledger database.");
        }
      } else {
        // Reset Button properties to original look
        oButton.setText("Show Order History");
        oButton.setIcon("sap-icon://history");
        oButton.setType("Emphasized");
      }
    },
    formatTierName: function _formatTierName(sStatusCode) {
      if (!sStatusCode) {
        return "STANDARD TIER";
      }
      const sNormalized = sStatusCode.toUpperCase().trim();
      switch (sNormalized) {
        case "GOLD":
          return "🌟 GOLD MEMBER";
        case "SILVER":
          return "✨ SILVER MEMBER";
        default:
          return sNormalized + " MEMBER";
      }
    },
    onTabSelect: function _onTabSelect(oEvent) {
      // 1. Grab the selected item's key string token
      const sSelectedKey = oEvent.getParameter("key") || "";
      console.log("📥 Raw Tab Selected Key:", sSelectedKey);
      const oFooterToolbar = this.byId("cartFooterToolbar");
      oFooterToolbar.setVisible(false);
      if (sSelectedKey.includes("profileTab")) {
        console.log("profile Tab");
      }
      if (oFooterToolbar) {
        console.log(sSelectedKey.includes("cartTab"));
        const bIsShoppingCartActive = sSelectedKey.includes("cartTab");
        const bIsInteractionsActive = sSelectedKey.includes("interactionsTab");
        oFooterToolbar.setVisible(bIsShoppingCartActive);
        console.log(`🔄 Footer Display State Forced To: ${bIsShoppingCartActive}`);
        if (bIsShoppingCartActive) {
          const oList = this.byId("dashboardCartList");
          const oBinding = oList.getBinding("items");
          if (oBinding) {
            oBinding.refresh();
          }
          const iIntervalId = setInterval(() => {
            const aItems = oList.getItems();
            if (aItems && aItems.length > 0) {
              console.log(`⚡ Success! Found ${aItems.length} items in the list. Running sum...`);
              clearInterval(iIntervalId); // Stop polling immediately
              this.getSumCart();
            }
          }, 300);

          // Safety guard: Clear the interval after 5 seconds so it doesn't run forever if the cart is truly empty
          setTimeout(() => clearInterval(iIntervalId), 5000);
          this.getSumCart();
        }
      }
    },
    onCheckoutPress: async function _onCheckoutPress(oEvent) {
      const oView = this.getView();
      const oList = this.byId("dashboardCartList");
      const aCardItem = oList.getItems();
      const oButton = oEvent.getSource();
      if (!aCardItem[0]) {
        MessageToast.show("Your cart is empty.");
        return;
      }
      const oItemContext = aCardItem[0].getBindingContext();
      if (!oItemContext) return;
      oView.setBusy(true);
      try {
        const oModel = oItemContext.getModel();
        const oItemData = oItemContext.getObject();
        const sParentOrderId = oItemData.parent_ID;
        if (!sParentOrderId) throw new Error("No parent order ID");
        const sOrderPath = `/Orders(ID=${sParentOrderId},IsActiveEntity=false)`;
        const oOrderContext = oModel.bindContext(sOrderPath).getBoundContext();
        const oOperation = oModel.bindContext("PublicStorefrontService.draftActivate(...)", oOrderContext);
        await oOperation.execute();

        // Only hide items after success
        aCardItem.forEach(card => card.setVisible(false));
        const totalLabel = this.byId("totalNumber");
        totalLabel.setNumber(0);
        MessageToast.show("Order placed successfully!");
      } catch (oError) {
        MessageToast.show("Checkout failed. Please try again.");
      } finally {
        oView.setBusy(false);
      }
    },
    onAfterRendering: function _onAfterRendering() {
      console.log("render user");
      const oFooterToolbar = this.byId("cartFooterToolbar");
      oFooterToolbar.setVisible(false);
      const oList = this.byId("dashboardCartList");
      if (!oList) {
        return;
      }

      // Safety guard: Clear the interval after 5 seconds so it doesn't run forever if the cart is truly empty
    },
    onRemoveFromWishlist: async function _onRemoveFromWishlist(oEvent) {
      const oCrossIcon = oEvent.getSource();

      // 1. Resolve the specific OData row data context bounding instance
      const oContext = oCrossIcon.getBindingContext();
      if (!oContext) return;
      const oView = this.getView();
      oView?.setBusy(true);
      try {
        const sProductName = oContext.getProperty("product/name") || "Item";

        // 2. Dispatch the standard asynchronous OData deletion query
        await oContext.delete();

        // 3. Inform user. UI5 layout engines will auto-animate the card collapsing away
        MessageToast.show(`✨ ${sProductName} removed from your wishlist.`);
      } catch (oError) {
        console.error("❌ Wishlist item deletion dropped:", oError);
        MessageToast.show("Could not remove item. Please try again.");
      } finally {
        oView?.setBusy(false);
      }
    },
    getSumCart: function _getSumCart() {
      console.log("sum cart");
      const list = this.byId("dashboardCartList");
      if (!list) {
        return;
      }
      const aListItems = list.getItems();
      let nTotalSum = 0;
      console.log(aListItems);
      console.log(aListItems.length);
      aListItems.forEach(oItem => {
        const oBindingContext = oItem.getBindingContext();
        if (!oBindingContext) {
          return;
        }
        const oItemData = oBindingContext.getObject();
        console.log("item ", oItemData);
        if (!oItemData) {
          return;
        }
        nTotalSum += oItemData.priceAtOrder * oItemData.quantity;
      });
      const oTotalControl = this.byId("totalNumber");
      if (oTotalControl) {
        const sFormattedTotal = nTotalSum.toFixed(2);
        oTotalControl.setNumber(sFormattedTotal);
        console.log(`💰 Pinned Dashboard Total updated to: ${sFormattedTotal} USD`);
      }
    },
    onNavBack: function _onNavBack() {
      const mainTab = this.byId("dashboardTabBar");
      if (mainTab) {
        mainTab.setSelectedKey("profileTab");
      }
      const oHistory = History.getInstance();
      const sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteMainView", {}, true);
      }
    },
    onOrderRowPress: function _onOrderRowPress(oEvent) {
      const oClickedRow = oEvent.getSource();
      const oOrderContext = oClickedRow.getBindingContext();
      if (!oOrderContext) {
        return;
      }
      const sOrderId = oOrderContext.getProperty("ID");
      console.log(`🚀 Routing to detail page with clean GUID: ${sOrderId}`);
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteOrderDetail", {
        orderId: sOrderId
      });
    },
    _openFeedbackDialog: async function _openFeedbackDialog() {
      const oView = this.getView();
      if (!this._oFeedbackDialog) {
        this._oFeedbackDialog = await Fragment.load({
          id: oView.getId(),
          name: "test.view.CreateFeedbackDialog",
          controller: this
        });
        oView.addDependent(this._oFeedbackDialog);
      }

      // Dynamically set properties based on what row was clicked
      oView.byId("txtFeedbackTargetName").setText(this._oActiveFeedbackContext.targetName);
      oView.byId("rateFeedbackStars").setValue(5);
      oView.byId("txtFeedbackComment").setValue("");
      this._oFeedbackDialog.open();
    },
    /**
     * Closes the feedback dialog box cleanly
     */
    onCloseFeedbackDialog: function _onCloseFeedbackDialog() {
      if (this._oFeedbackDialog) {
        this._oFeedbackDialog.close();
      }
    },
    /**
     * Submits the interaction review payload directly to the /Feedbacks OData collection
     */
    onSubmitFeedbackForm: async function _onSubmitFeedbackForm() {
      const oView = this.getView();
      const oModel = oView.getModel();
      const iRatingValue = oView.byId("rateFeedbackStars").getValue();
      const sCommentText = oView.byId("txtFeedbackComment").getValue();
      if (!sCommentText || !sCommentText.trim()) {
        MessageToast.show("Please enter a review comment.");
        return;
      }
      const oUserModel = oView.getModel("currentUser");
      const sCustomerId = oUserModel?.getProperty("/id")?.id || oUserModel?.getProperty("/id");
      const oFeedbackBindingList = oModel.bindList("/Feedbacks");

      // Unified payload linking perfectly to your interaction_ID context
      const oFinalPayload = {
        "customer_ID": String(sCustomerId),
        "rating": parseInt(iRatingValue, 10),
        "comment": sCommentText.trim(),
        "order_ID": this._oActiveFeedbackContext.payload.order_ID,
        "orderItem_ID": this._oActiveFeedbackContext.payload.orderItem_ID,
        "interaction_ID": this._oActiveFeedbackContext.payload.interaction_ID
      };
      try {
        oView.setBusy(true);
        this.onCloseFeedbackDialog();
        const oNewContext = oFeedbackBindingList.create(oFinalPayload);
        await oNewContext.created();
        MessageToast.show("Thank you for your valuable feedback review!");
      } catch (oError) {
        console.error("❌ Failed to submit dashboard interaction feedback:", oError);
        MessageToast.show("Error submitting review.");
      } finally {
        oView.setBusy(false);
      }
    },
    checkFeedbackAvailability: function _checkFeedbackAvailability(sStatusCode) {
      if (!sStatusCode) {
        return false;
      }
      const sNormalizedStatus = sStatusCode.toUpperCase().trim();
      return sNormalizedStatus === "CLOSED" || sNormalizedStatus === "RESOLVED";
    },
    onOpenInteractionFeedback: function _onOpenInteractionFeedback(oEvent) {
      const oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      const oInteractionData = oRowContext.getObject();

      // Build the dynamic targeting payload using the exclusive association mappings
      this._oActiveFeedbackContext = {
        targetName: `Support Case Log ID: ${oInteractionData.caseNumber || "Ledger Entry"}`,
        payload: {
          interaction_ID: oInteractionData.ID,
          // Links directly to the ticket ID
          order_ID: null,
          // Mutual exclusivity flags are preserved clean
          orderItem_ID: null
        }
      };

      // Invoke your established asynchronous loader utility to show the popup form
      this._openFeedbackDialog();
    },
    formatStatusCriticality: function _formatStatusCriticality(sStatusCode) {
      switch (sStatusCode?.toUpperCase()) {
        case "CLOSED":
          return "Success";
        // Green
        case "RESOLVED":
          return "Success";
        // Green
        case "OPEN":
          return "Warning";
        // Orange/Yellow
        case "PENDING":
          return "None";
        // Neutral Blue
        default:
          return "None";
      }
    }
  });
  return CustomerDashboardController;
});
//# sourceMappingURL=CustomerDashboard-dbg.controller.js.map
